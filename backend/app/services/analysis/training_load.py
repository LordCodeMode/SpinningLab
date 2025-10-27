import pandas as pd
from typing import List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ...database.models import User, Activity

class TrainingLoadResponse:
    def __init__(self, date: datetime, ctl: float, atl: float, tsb: float, tss: float):
        self.date = date
        self.ctl = ctl
        self.atl = atl
        self.tsb = tsb
        self.tss = tss

class TrainingLoadService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_training_load(self, user: User, days: int = 90) -> List[TrainingLoadResponse]:
        """Calculate CTL, ATL, TSB for user."""
        # Get activities with TSS
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days + 42)  # Extra days for CTL calculation
        
        activities = self.db.query(Activity).filter(
            and_(
                Activity.user_id == user.id,
                Activity.start_time >= start_date,
                Activity.tss.isnot(None),
                Activity.tss > 0
            )
        ).order_by(Activity.start_time).all()

        if not activities:
            # Return empty data for the requested period
            date_range = pd.date_range(
                start=end_date - timedelta(days=days), 
                end=end_date, 
                freq='D'
            )
            return [
                TrainingLoadResponse(date=date, ctl=0.0, atl=0.0, tsb=0.0, tss=0.0)
                for date in date_range
            ]

        # Create daily TSS dataframe
        df = pd.DataFrame([{
            'date': activity.start_time.date(),
            'tss': activity.tss
        } for activity in activities])

        df = df.groupby('date')['tss'].sum().reset_index()
        
        # Convert date column to datetime for consistent comparison
        df['date'] = pd.to_datetime(df['date'])

        # Fill missing days with 0 TSS
        full_start = pd.to_datetime(start_date.date())
        full_end = pd.to_datetime(end_date.date())
        date_range = pd.date_range(start=full_start, end=full_end, freq='D')
        
        df = df.set_index('date').reindex(date_range, fill_value=0).reset_index()
        df.columns = ['date', 'tss']

        # Calculate CTL and ATL
        ctl_constant = 42
        atl_constant = 7
        
        ctl, atl = [], []
        ctl_prev, atl_prev = 0.0, 0.0

        for tss in df['tss']:
            ctl_today = ctl_prev + (tss - ctl_prev) * (1 / ctl_constant)
            atl_today = atl_prev + (tss - atl_prev) * (1 / atl_constant)
            ctl.append(ctl_today)
            atl.append(atl_today)
            ctl_prev = ctl_today
            atl_prev = atl_today

        df['ctl'] = ctl
        df['atl'] = atl
        df['tsb'] = df['ctl'] - df['atl']

        # Return only the requested period - fix the datetime comparison
        result_start = pd.to_datetime((end_date - timedelta(days=days)).date())
        df_filtered = df[df['date'] >= result_start].copy()

        return [
            TrainingLoadResponse(
                date=row['date'].to_pydatetime(),  # Convert to Python datetime
                ctl=round(row['ctl'], 2),
                atl=round(row['atl'], 2),
                tsb=round(row['tsb'], 2),
                tss=round(row['tss'], 2)
            )
            for _, row in df_filtered.iterrows()
        ]
