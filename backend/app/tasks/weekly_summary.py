"""
Weekly summary task runner.
Uses APScheduler to run weekly summaries if available.
"""

from datetime import datetime

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except Exception as exc:  # pragma: no cover
    BackgroundScheduler = None

from ..database.connection import SessionLocal
from ..database.models import User
from ..services.insights.insight_generator import InsightGenerator


def run_weekly_summary():
    db = SessionLocal()
    try:
        generator = InsightGenerator(db)
        users = db.query(User).all()
        for user in users:
            summary = generator.weekly_summary(user, days=7)
            print(f"[WeeklySummary] {user.username}: {summary}")
    finally:
        db.close()


def start_scheduler():
    if not BackgroundScheduler:
        print("APScheduler not installed. Run weekly_summary.py manually.")
        return

    scheduler = BackgroundScheduler()
    scheduler.add_job(run_weekly_summary, "cron", day_of_week="mon", hour=7, minute=0)
    scheduler.start()
    print(f"Weekly summary scheduler started at {datetime.utcnow().isoformat()}Z")


if __name__ == "__main__":
    start_scheduler()
