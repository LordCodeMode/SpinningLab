from __future__ import annotations

import contextvars
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from .config import settings

request_id_context: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_context.get()
        record.user_id = getattr(record, "user_id", None)
        record.job_id = getattr(record, "job_id", None)
        record.event_type = getattr(record, "event_type", None)
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if getattr(record, "request_id", None):
            payload["request_id"] = record.request_id
        if getattr(record, "user_id", None) is not None:
            payload["user_id"] = record.user_id
        if getattr(record, "job_id", None):
            payload["job_id"] = record.job_id
        if getattr(record, "event_type", None):
            payload["event_type"] = record.event_type
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=True)


def configure_logging() -> None:
    root = logging.getLogger()
    handler = logging.StreamHandler(sys.stdout)
    formatter: logging.Formatter
    if settings.JSON_LOGS:
        formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(request_id)s - %(event_type)s - %(user_id)s - %(job_id)s - %(message)s"
        )
    handler.setFormatter(formatter)
    handler.addFilter(RequestContextFilter())

    root.handlers.clear()
    root.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    root.addHandler(handler)
