from __future__ import annotations

import json
import mimetypes
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional

from ..core.config import settings


def build_fit_file_key(user_id: int, file_hash: str) -> str:
    return f"activities/{user_id}/{file_hash}.fit"


def build_stream_key(activity_identifier: int | str) -> str:
    return f"streams/{activity_identifier}.json"


def build_live_training_tcx_key(user_id: int, timestamp: int) -> str:
    return f"live-training/{user_id}/live_training_{user_id}_{timestamp}.tcx"


class StorageService:
    def __init__(self) -> None:
        self.backend = settings.STORAGE_BACKEND
        self.local_root = Path(settings.FIT_FILES_DIR)
        self.bucket = settings.STORAGE_BUCKET
        self.region = settings.STORAGE_REGION
        self.prefix = (settings.STORAGE_PREFIX or "").strip().strip("/")
        self.endpoint_url = settings.STORAGE_ENDPOINT_URL or None
        self._s3_client = None

    def _normalize_key(self, key: str) -> str:
        cleaned = str(key or "").strip().lstrip("/")
        if not cleaned:
            raise ValueError("Storage key must not be empty")
        return cleaned

    def _object_key(self, key: str) -> str:
        cleaned = self._normalize_key(key)
        return f"{self.prefix}/{cleaned}" if self.prefix else cleaned

    @property
    def s3_client(self):
        if self._s3_client is None:
            import boto3

            self._s3_client = boto3.client(
                "s3",
                region_name=self.region or None,
                endpoint_url=self.endpoint_url,
                aws_access_key_id=settings.STORAGE_ACCESS_KEY_ID or None,
                aws_secret_access_key=settings.STORAGE_SECRET_ACCESS_KEY or None,
            )
        return self._s3_client

    def resolve_local_path(self, key: str) -> Optional[str]:
        if self.backend != "local":
            return None
        return str(self.local_root / self._normalize_key(key))

    def put_bytes(self, key: str, data: bytes, content_type: Optional[str] = None) -> None:
        storage_key = self._normalize_key(key)
        if self.backend == "local":
            destination = self.local_root / storage_key
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            return

        self.s3_client.put_object(
            Bucket=self.bucket,
            Key=self._object_key(storage_key),
            Body=data,
            ContentType=content_type or mimetypes.guess_type(storage_key)[0] or "application/octet-stream",
        )

    def get_bytes(self, key: str) -> bytes:
        storage_key = self._normalize_key(key)
        if self.backend == "local":
            path = self.local_root / storage_key
            return path.read_bytes()

        response = self.s3_client.get_object(Bucket=self.bucket, Key=self._object_key(storage_key))
        return response["Body"].read()

    def exists(self, key: str) -> bool:
        storage_key = self._normalize_key(key)
        try:
            if self.backend == "local":
                return (self.local_root / storage_key).exists()

            self.s3_client.head_object(Bucket=self.bucket, Key=self._object_key(storage_key))
            return True
        except Exception:
            return False

    def delete(self, key: str) -> None:
        storage_key = self._normalize_key(key)
        if self.backend == "local":
            path = self.local_root / storage_key
            try:
                path.unlink()
            except FileNotFoundError:
                pass
            return

        self.s3_client.delete_object(Bucket=self.bucket, Key=self._object_key(storage_key))

    def copy(self, source_key: str, destination_key: str) -> None:
        source = self._normalize_key(source_key)
        destination = self._normalize_key(destination_key)
        if self.backend == "local":
            source_path = self.local_root / source
            destination_path = self.local_root / destination
            destination_path.parent.mkdir(parents=True, exist_ok=True)
            destination_path.write_bytes(source_path.read_bytes())
            return

        self.s3_client.copy_object(
            Bucket=self.bucket,
            CopySource={"Bucket": self.bucket, "Key": self._object_key(source)},
            Key=self._object_key(destination),
        )

    def put_json(self, key: str, payload: Any) -> None:
        self.put_bytes(
            key,
            json.dumps(payload).encode("utf-8"),
            content_type="application/json",
        )

    def get_json(self, key: str) -> Any:
        return json.loads(self.get_bytes(key).decode("utf-8"))

    @contextmanager
    def download_to_temp_path(self, key: str, suffix: str = "") -> Iterator[str]:
        storage_key = self._normalize_key(key)
        data = self.get_bytes(storage_key)
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
                handle.write(data)
                temp_path = handle.name
            yield temp_path
        finally:
            if temp_path:
                Path(temp_path).unlink(missing_ok=True)

    def readiness(self) -> dict[str, Any]:
        if self.backend == "local":
            self.local_root.mkdir(parents=True, exist_ok=True)
            return {"status": "ok", "backend": "local", "root": str(self.local_root)}

        required = {
            "bucket": self.bucket,
            "region": self.region,
            "access_key": settings.STORAGE_ACCESS_KEY_ID,
            "secret_key": settings.STORAGE_SECRET_ACCESS_KEY,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            return {"status": "error", "backend": "s3", "missing": missing}

        try:
            self.s3_client.head_bucket(Bucket=self.bucket)
            payload = {"status": "ok", "backend": "s3", "bucket": self.bucket, "region": self.region}
            if settings.STORAGE_HEALTHCHECK_WRITE_TEST:
                probe_key = f"_healthchecks/{int(time.time() * 1000)}.txt"
                self.put_bytes(probe_key, b"ok", content_type="text/plain")
                self.delete(probe_key)
                payload["write_test"] = "ok"
            return payload
        except Exception as exc:
            return {"status": "error", "backend": "s3", "detail": str(exc)}


storage_service = StorageService()
