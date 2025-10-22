import os
import json
import pickle
import hashlib
from typing import Any, Optional, Dict
from datetime import datetime, timedelta

from ...core.config import settings

class CacheManager:
    def __init__(self, cache_dir: str = None):
        self.cache_dir = cache_dir or settings.CACHE_DIR
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_cache_path(self, key: str, user_id: int) -> str:
        """Get cache file path for a given key and user."""
        user_cache_dir = os.path.join(self.cache_dir, str(user_id))
        os.makedirs(user_cache_dir, exist_ok=True)
        
        # Hash the key to avoid filesystem issues
        key_hash = hashlib.md5(key.encode()).hexdigest()
        return os.path.join(user_cache_dir, f"{key_hash}.cache")

    def get(self, key: str, user_id: int, max_age_hours: int = 24) -> Optional[Any]:
        """Get cached data if it exists and is not expired."""
        cache_path = self._get_cache_path(key, user_id)
        
        if not os.path.exists(cache_path):
            return None
        
        try:
            # Check if cache is expired
            cache_age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(cache_path))
            if cache_age > timedelta(hours=max_age_hours):
                os.remove(cache_path)
                return None
            
            with open(cache_path, 'rb') as f:
                return pickle.load(f)
                
        except Exception as e:
            print(f"Error reading cache {key}: {e}")
            return None

    def set(self, key: str, user_id: int, data: Any) -> bool:
        """Set cached data."""
        cache_path = self._get_cache_path(key, user_id)
        
        try:
            with open(cache_path, 'wb') as f:
                pickle.dump(data, f)
            return True
        except Exception as e:
            print(f"Error writing cache {key}: {e}")
            return False

    def delete(self, key: str, user_id: int) -> bool:
        """Delete cached data."""
        cache_path = self._get_cache_path(key, user_id)
        
        try:
            if os.path.exists(cache_path):
                os.remove(cache_path)
            return True
        except Exception as e:
            print(f"Error deleting cache {key}: {e}")
            return False

    def clear_user_cache(self, user_id: int) -> bool:
        """Clear all cache for a user."""
        user_cache_dir = os.path.join(self.cache_dir, str(user_id))
        
        try:
            if os.path.exists(user_cache_dir):
                for file in os.listdir(user_cache_dir):
                    file_path = os.path.join(user_cache_dir, file)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                os.rmdir(user_cache_dir)
            return True
        except Exception as e:
            print(f"Error clearing cache for user {user_id}: {e}")
            return False

    def get_cache_info(self, user_id: int) -> Dict[str, Any]:
        """Get information about cached data for a user."""
        user_cache_dir = os.path.join(self.cache_dir, str(user_id))
        
        if not os.path.exists(user_cache_dir):
            return {"files": 0, "total_size": 0, "files_list": []}
        
        files_list = []
        total_size = 0
        
        for file in os.listdir(user_cache_dir):
            file_path = os.path.join(user_cache_dir, file)
            if os.path.isfile(file_path):
                stat = os.stat(file_path)
                files_list.append({
                    "name": file,
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
                total_size += stat.st_size
        
        return {
            "files": len(files_list),
            "total_size": total_size,
            "files_list": files_list
        }