"""
Script to remove debug print statements and add proper logging to Python files.
Run this from the backend directory to clean up debug output.
"""

import re
from pathlib import Path

# Files to clean up (relative to backend directory)
FILES_TO_CLEAN = [
    "app/api/routes/analysis_old.py",
    "app/services/analysis/power_curve.py",
    "app/api/routes/analysis/rider_profile.py",
    "app/api/routes/analysis/critical_power.py",
    "app/api/routes/analysis/zones.py",
    "app/api/routes/analysis/training_load.py",
    "app/api/routes/analysis/power_curve.py",
    "app/services/fit_processing/heart_rate_metrics.py",
    "app/services/fit_processing/zones.py",
    "app/services/fit_processing/fit_import_service.py",
    "app/api/routes/auth.py",
    "app/services/analysis/critical_power.py",
    "app/services/fit_processing/core_metrics.py",
    "app/utils/file_operations.py",
]

def remove_print_statements(file_path: Path) -> tuple[int, list[str]]:
    """
    Remove print statements from a file and return count + lines removed.

    Returns:
        Tuple of (count_removed, removed_lines)
    """
    if not file_path.exists():
        return 0, []

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    removed_lines = []
    new_lines = []
    count = 0

    for line in lines:
        # Check if line contains a print statement
        if re.match(r'^\s*print\s*\(', line):
            removed_lines.append(line.strip())
            count += 1
            # Skip this line
            continue
        new_lines.append(line)

    if count > 0:
        # Write back the cleaned file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)

    return count, removed_lines

def main():
    """Clean up all files."""
    backend_dir = Path(__file__).parent

    total_removed = 0
    files_modified = 0

    print("=" * 80)
    print("DEBUG STATEMENT CLEANUP UTILITY")
    print("=" * 80)

    for file_rel in FILES_TO_CLEAN:
        file_path = backend_dir / file_rel

        count, removed = remove_print_statements(file_path)

        if count > 0:
            files_modified += 1
            total_removed += count
            print(f"\n✓ {file_rel}")
            print(f"  Removed {count} print statement(s)")

    print("\n" + "=" * 80)
    print(f"SUMMARY: Removed {total_removed} print statements from {files_modified} files")
    print("=" * 80)

    if files_modified > 0:
        print("\n⚠️  Next steps:")
        print("1. Review the changes with 'git diff'")
        print("2. Add proper logging with 'from ....core.logging_config import get_logger'")
        print("3. Replace removed prints with logger.debug(), logger.info(), etc.")
        print("4. Run tests to ensure nothing broke")

if __name__ == "__main__":
    main()
