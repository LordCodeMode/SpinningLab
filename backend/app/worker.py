from __future__ import annotations

import logging

from redis import Redis
from rq import Connection, Worker

from .core.config import settings
from .core.logging import configure_logging


def configure_sentry() -> None:
    if not settings.SENTRY_DSN or settings.APP_ENV not in {"staging", "production"}:
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.rq import RqIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            integrations=[
                LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
                RqIntegration(),
            ],
            traces_sample_rate=0.0,
        )
        sentry_sdk.set_tag("app", "worker")
    except Exception as exc:  # pragma: no cover - optional dependency
        logging.getLogger(__name__).warning("Failed to initialize worker Sentry: %s", exc)


def main() -> None:
    configure_logging()
    configure_sentry()

    logger = logging.getLogger(__name__)
    connection = Redis.from_url(settings.REDIS_URL)
    worker = Worker([settings.RQ_QUEUE_NAME], connection=connection)
    logger.info(
        "Starting RQ worker",
        extra={"event_type": "worker_start", "job_id": None, "user_id": None},
    )
    with Connection(connection):
        worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
