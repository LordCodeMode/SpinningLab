#!/usr/bin/env python3
"""
Diagnostic script to test training load calculation and caching for a user
Run this on your Mac where the backend is running
"""

import argparse
import sys
import os
from datetime import datetime, timedelta

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import get_db
from app.database.models import User, Activity
from app.services.analysis.training_load import TrainingLoadService
from app.services.cache.cache_manager import CacheManager
from sqlalchemy.orm import Session

def print_section(title):
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}\n")

def parse_args():
    parser = argparse.ArgumentParser(description="Diagnose training load for a user.")
    parser.add_argument("--email", help="User email to target")
    parser.add_argument("--user-id", type=int, help="User ID to target")
    return parser.parse_args()


def find_user(db: Session, args):
    if args.user_id is not None:
        return db.query(User).filter(User.id == args.user_id).first()
    if args.email:
        return db.query(User).filter(User.email == args.email).first()
    return db.query(User).order_by(User.id.asc()).first()


def check_user_activities(db: Session, user: User):
    """Check user activities and TSS values"""
    print_section("USER ACTIVITIES CHECK")

    if not user:
        print("ERROR: User not found!")
        return None

    print(f"User ID: {user.id}")
    print(f"User Email: {user.email}")
    print(f"User FTP: {user.ftp}")
    print(f"User HR Max: {user.hr_max}")

    activities = db.query(Activity).filter(Activity.user_id == user.id).order_by(Activity.start_time.desc()).all()

    print(f"\nTotal Activities: {len(activities)}")

    if not activities:
        print("ERROR: No activities found for user!")
        return user

    print("\nActivity Details:")
    print(f"{'ID':<6} {'File Name':<30} {'Date':<12} {'Dur(s)':<8} {'Dist(km)':<10} {'AvgPwr':<8} {'NP':<8} {'TSS':<8}")
    print("-" * 100)

    missing_tss_count = 0
    for act in activities:
        tss_str = f"{act.tss:.1f}" if act.tss is not None else "NULL"
        if act.tss is None:
            missing_tss_count += 1

        print(f"{act.id:<6} {act.file_name[:28]:<30} {act.start_time.strftime('%Y-%m-%d'):<12} {act.duration or 0:<8.0f} {act.distance or 0:<10.2f} {act.avg_power or 0:<8.0f} {act.normalized_power or 0:<8.0f} {tss_str:<8}")

    if missing_tss_count > 0:
        print(f"\n⚠️  WARNING: {missing_tss_count} activities missing TSS values!")
        print("This will prevent CTL/ATL/TSB calculation from working correctly.")
    else:
        print(f"\n✓ All {len(activities)} activities have TSS values")

    return user

def test_training_load_calculation(db: Session, user: User):
    """Test the TrainingLoadService calculation"""
    print_section("TRAINING LOAD CALCULATION TEST")

    if not user:
        print("Skipping - user not found")
        return None

    try:
        service = TrainingLoadService(db)

        # Calculate for different time periods
        for days in [30, 60, 90]:
            print(f"\nCalculating training load for last {days} days...")
            training_load = service.calculate_training_load(user, days=days)

            if not training_load:
                print(f"  ⚠️  No training load data returned for {days} days")
                continue

            print(f"  ✓ Returned {len(training_load)} data points")

            if len(training_load) > 0:
                latest = training_load[-1]
                print(f"  Latest values (date: {latest.date}):")
                print(f"    CTL: {latest.ctl:.2f}" if latest.ctl is not None else "    CTL: NULL")
                print(f"    ATL: {latest.atl:.2f}" if latest.atl is not None else "    ATL: NULL")
                print(f"    TSB: {latest.tsb:.2f}" if latest.tsb is not None else "    TSB: NULL")

                # Show first few days
                print(f"\n  First 5 data points:")
                for i, item in enumerate(training_load[:5]):
                    print(f"    {item.date}: CTL={item.ctl:.2f}, ATL={item.atl:.2f}, TSB={item.tsb:.2f}")

        return training_load

    except Exception as e:
        print(f"ERROR calculating training load: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_cache_system(db: Session, user: User):
    """Test the cache manager"""
    print_section("CACHE SYSTEM TEST")

    if not user:
        print("Skipping - user not found")
        return

    try:
        cache_manager = CacheManager()

        # Check if cache directory exists
        cache_dir = f"cache/{user.id}"
        cache_path = os.path.join(os.path.dirname(__file__), cache_dir)
        print(f"Cache directory: {cache_path}")

        if os.path.exists(cache_path):
            print(f"✓ Cache directory exists")
            files = os.listdir(cache_path)
            print(f"  Files in cache: {files}")
        else:
            print(f"⚠️  Cache directory does NOT exist")

        # Try to get training load from cache
        print("\nAttempting to get training load from cache...")
        cached_data = cache_manager.get_training_load(user.id)

        if cached_data:
            print(f"✓ Cache hit! Retrieved cached training load data")
            if isinstance(cached_data, list) and len(cached_data) > 0:
                print(f"  Data points: {len(cached_data)}")
                latest = cached_data[-1]
                print(f"  Latest: date={latest.get('date')}, CTL={latest.get('ctl')}, ATL={latest.get('atl')}, TSB={latest.get('tsb')}")
        else:
            print("⚠️  Cache miss - no training load data in cache")

        # Try to rebuild cache
        print("\nRebuilding cache for user...")
        from app.services.cache.cache_builder import CacheBuilder
        cache_builder = CacheBuilder(db)
        cache_builder.rebuild_cache_for_user(user.id)
        print("✓ Cache rebuild completed")

        # Check cache again after rebuild
        print("\nChecking cache after rebuild...")
        cached_data = cache_manager.get_training_load(user.id)

        if cached_data:
            print(f"✓ Cache now contains training load data")
            if isinstance(cached_data, list) and len(cached_data) > 0:
                print(f"  Data points: {len(cached_data)}")
                latest = cached_data[-1]
                print(f"  Latest: date={latest.get('date')}, CTL={latest.get('ctl')}, ATL={latest.get('atl')}, TSB={latest.get('tsb')}")
        else:
            print("❌ Cache STILL empty after rebuild - this is a problem!")

    except Exception as e:
        print(f"ERROR testing cache: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Run all diagnostic tests"""
    print("\n" + "="*60)
    print(" TRAINING LOAD DIAGNOSTIC TOOL")
    print("="*60)

    # Get database session
    db = next(get_db())

    try:
        args = parse_args()
        user = find_user(db, args)
        if user:
            print(f" User: {user.email} (ID: {user.id})")

        # 1. Check activities
        user = check_user_activities(db, user)

        # 2. Test training load calculation
        training_load = test_training_load_calculation(db, user)

        # 3. Test cache system
        test_cache_system(db, user)

        print_section("SUMMARY")
        print("Diagnostic complete. Review the output above for any errors or warnings.")
        print("\nIf you see:")
        print("  • Missing TSS values → Backend power metrics calculation issue")
        print("  • Training load calculation errors → TrainingLoadService issue")
        print("  • Empty cache after rebuild → Cache builder issue")
        print("  • Cache directory doesn't exist → File permissions or path issue")

    finally:
        db.close()

if __name__ == "__main__":
    main()
