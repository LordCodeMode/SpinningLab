import os
import hashlib
from typing import Optional

def compute_file_hash(file_path: str) -> Optional[str]:
    """Compute MD5 hash of a file."""
    try:
        with open(file_path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception as e:
        print(f"Error computing hash for {file_path}: {e}")
        return None

def ensure_directory_exists(directory: str) -> None:
    """Ensure a directory exists, create if it doesn't."""
    os.makedirs(directory, exist_ok=True)

def get_file_size(file_path: str) -> Optional[int]:
    """Get file size in bytes."""
    try:
        return os.path.getsize(file_path)
    except Exception:
        return None