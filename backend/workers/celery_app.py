from __future__ import annotations

from celery import Celery

from app.config import get_settings


def create_celery_app() -> Celery:
    """Create and configure the Celery application."""
    settings = get_settings()

    celery_app = Celery(
        "pratyaksha_workers",
        broker=settings.redis_url,
        backend=settings.redis_url,
        include=[
            "workers.tasks.video_analysis",
            "workers.tasks.audio_analysis",
            "workers.tasks.report_generation",
        ],
    )
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
    )
    return celery_app


app = create_celery_app()

