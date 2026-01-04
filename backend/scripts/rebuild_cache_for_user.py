#!/usr/bin/env python3
"""
Simple script to manually trigger cache rebuild for a user
Run this on your Mac where the backend is running
"""

import argparse
import sys
import os

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import get_db
from app.database.models import User
from app.services.cache.cache_builder import CacheBuilder

def parse_args():
    parser = argparse.ArgumentParser(description="Rebuild cache for a user.")
    parser.add_argument("--email", help="User email to target")
    parser.add_argument("--user-id", type=int, help="User ID to target")
    return parser.parse_args()


def main():
    """Rebuild cache for a specific user."""

    print("="*60)
    print(" CACHE REBUILD TOOL")
    print("="*60)

    # Get database session
    db = next(get_db())

    try:
        args = parse_args()

        # Find user
        user = None
        if args.user_id is not None:
            user = db.query(User).filter(User.id == args.user_id).first()
        elif args.email:
            user = db.query(User).filter(User.email == args.email).first()
        else:
            user = db.query(User).order_by(User.id.asc()).first()

        if not user:
            target = f"id={args.user_id}" if args.user_id is not None else f"email={args.email}"
            print(f"❌ ERROR: User {target} not found!")
            return

        print(f"\n✓ Found user: {user.email} (ID: {user.id})")
        print(f"  FTP: {user.ftp}")
        print(f"  Weight: {user.weight} kg")

        # Count activities
        from app.database.models import Activity
        activity_count = db.query(Activity).filter(Activity.user_id == user.id).count()
        print(f"  Activities: {activity_count}")

        if activity_count == 0:
            print("\n⚠️  WARNING: No activities found for this user!")
            print("Cache will be built but will contain empty data.")

        # Rebuild cache
        print("\n" + "="*60)
        print(" REBUILDING CACHE...")
        print("="*60)

        cache_builder = CacheBuilder(db)
        result = cache_builder.rebuild_after_import(user)

        # Display results
        print("\n" + "="*60)
        print(" RESULTS")
        print("="*60)

        if result["success"]:
            print(f"\n✅ Cache rebuild SUCCESSFUL!")
            print(f"   Duration: {result['duration_seconds']:.2f} seconds")
        else:
            print(f"\n⚠️  Cache rebuild completed with some failures")
            print(f"   Duration: {result['duration_seconds']:.2f} seconds")

        print("\nOperation Results:")
        for name, op_result in result["operations"].items():
            status = "✅" if op_result.get("success") else "❌"
            print(f"  {status} {name}: {op_result.get('message', op_result.get('error', 'Unknown'))}")

        # Show cache status
        print("\n" + "="*60)
        print(" CACHE STATUS")
        print("="*60)

        status = cache_builder.get_cache_status(user)
        print(f"\nCache built at: {status.get('cache_built_at', 'Unknown')}")
        print(f"Total cache files: {status.get('total_files', 0)}")
        print(f"Total size: {status.get('total_size_bytes', 0) / 1024:.1f} KB")

        if status.get('files'):
            print("\nCache files:")
            for file_info in status['files'][:10]:  # Show first 10
                print(f"  - {file_info['name']} ({file_info['size']} bytes)")

        print("\n" + "="*60)
        print(" NEXT STEPS")
        print("="*60)
        print("\n1. Refresh your dashboard in the browser")
        print("2. Check backend logs for '[Cache HIT]' messages")
        print("3. You should now see CTL/ATL/TSB values and graphs!")
        print("\n")

    finally:
        db.close()

if __name__ == "__main__":
    main()
