from sqlalchemy import create_engine, text
from app.core.config import settings
from app.database.models import User, Activity
from app.database.connection import SessionLocal

# Create a database session
db = SessionLocal()

try:
    # Check total activities
    total_activities = db.query(Activity).count()
    print(f"📊 Total activities in database: {total_activities}")
    
    if total_activities == 0:
        print("\n⚠️  NO ACTIVITIES FOUND!")
        print("You need to upload FIT files through the upload page first.")
        
        # Check if users exist
        total_users = db.query(User).count()
        print(f"\n👥 Total users: {total_users}")
        if total_users > 0:
            user = db.query(User).first()
            print(f"   User: {user.username} (ID: {user.id})")
            print(f"   FTP: {user.ftp}, Weight: {user.weight}")
    else:
        # Get first user
        user = db.query(User).first()
        print(f"\n👤 Checking data for user: {user.username} (ID: {user.id})")
        
        # Check activities for this user
        user_activities = db.query(Activity).filter(Activity.user_id == user.id).all()
        print(f"\n📈 Activities for this user: {len(user_activities)}")
        
        # Check power data
        with_power = db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.avg_power.isnot(None)
        ).count()
        
        with_1min = db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.max_1min_power.isnot(None)
        ).count()
        
        with_5min = db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.max_5min_power.isnot(None)
        ).count()
        
        print(f"\n⚡ Power data statistics:")
        print(f"   Activities with avg_power: {with_power}")
        print(f"   Activities with max_1min_power: {with_1min}")
        print(f"   Activities with max_5min_power: {with_5min}")
        
        # Show sample activities
        print(f"\n📋 Sample activities (most recent 5):")
        recent = db.query(Activity).filter(
            Activity.user_id == user.id
        ).order_by(Activity.start_time.desc()).limit(5).all()
        
        for act in recent:
            print(f"\n   File: {act.file_name}")
            print(f"   Duration: {act.duration}s ({act.duration/60:.1f} min)")
            print(f"   Avg Power: {act.avg_power}")
            print(f"   Max 1min: {act.max_1min_power}")
            print(f"   Max 5min: {act.max_5min_power}")
            print(f"   Max 20min: {act.max_20min_power}")
        
        # Check what the API would return
        print(f"\n🔍 What the API endpoint would return:")
        from sqlalchemy import func
        result = db.query(
            func.max(Activity.max_5sec_power).label('max_5sec'),
            func.max(Activity.max_1min_power).label('max_1min'),
            func.max(Activity.max_3min_power).label('max_3min'),
            func.max(Activity.max_5min_power).label('max_5min'),
            func.max(Activity.max_10min_power).label('max_10min'),
            func.max(Activity.max_20min_power).label('max_20min'),
            func.max(Activity.max_30min_power).label('max_30min'),
        ).filter(Activity.user_id == user.id).first()
        
        print(f"   max_1min_power: {result.max_1min}")
        print(f"   max_3min_power: {result.max_3min}")
        print(f"   max_5min_power: {result.max_5min}")
        print(f"   max_10min_power: {result.max_10min}")
        print(f"   max_20min_power: {result.max_20min}")
        print(f"   max_30min_power: {result.max_30min}")

finally:
    db.close()