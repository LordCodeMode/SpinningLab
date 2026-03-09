#!/usr/bin/env python
from __future__ import annotations

import argparse
from pathlib import Path

from app.core.config import settings
from app.services.storage_service import storage_service


def iter_local_files(root: Path):
    if not root.exists():
        return
    for path in root.rglob("*"):
        if path.is_file():
            yield path


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill local fit_files artifacts into object storage.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be copied without uploading.")
    parser.add_argument("--verify", action="store_true", help="Verify destination objects exist after copy.")
    parser.add_argument("--delete-source", action="store_true", help="Delete local files after successful copy.")
    args = parser.parse_args()

    if settings.STORAGE_BACKEND != "s3":
        raise SystemExit("STORAGE_BACKEND must be set to 's3' for backfill.")

    local_root = Path(settings.FIT_FILES_DIR)
    copied = 0
    skipped = 0

    for path in iter_local_files(local_root):
        key = str(path.relative_to(local_root)).replace("\\", "/")
        if storage_service.exists(key):
            skipped += 1
            print(f"SKIP {key}")
            continue

        print(f"COPY {key}")
        if args.dry_run:
            copied += 1
            continue

        storage_service.put_bytes(key, path.read_bytes())
        if args.verify and not storage_service.exists(key):
            raise RuntimeError(f"Verification failed for {key}")
        if args.delete_source:
            path.unlink()
        copied += 1

    print(f"Completed. copied={copied} skipped={skipped} dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
