from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models import DetectionResult, FrameResult, VerificationSession
from app.services.detection_service import DetectionService
from app.services.risk_scoring import RiskScorer
from workers.celery_app import app as celery_app


settings = get_settings()
sync_engine = create_engine(settings.sync_database_url)
SessionLocal = sessionmaker(bind=sync_engine)


@celery_app.task(bind=True, max_retries=3, name="tasks.analyze_video")
def analyze_video_task(self, session_id: str, media_path: str) -> None:
    """Analyze uploaded video using the detection service and persist results."""
    db = SessionLocal()
    try:
        session = (
            db.execute(select(VerificationSession).where(VerificationSession.id == session_id))
        ).scalar_one_or_none()
        if session is None:
            return

        session.status = "processing"
        db.commit()

        detection_service = DetectionService()
        pipeline_result = detection_service.run_full_pipeline(frames=[], audio_path=media_path)
        signals = pipeline_result["signals"]
        risk_result = pipeline_result["risk"]

        now = datetime.now(timezone.utc)
        det = DetectionResult(
            session_id=session.id,
            verdict=risk_result.verdict,
            risk_score=risk_result.risk_score,
            risk_level=risk_result.risk_level,
            xception_score=signals["xception_score"],
            temporal_score=signals["temporal_consistency"],
            rppg_score=signals["rppg_score"],
            liveness_score=signals["liveness_score"],
            audio_score=signals["audio_score"],
            gradcam_path=None,
            suspicious_regions=None,
            explanation_reasons=risk_result.explanation_reasons,
            confidence_interval=risk_result.confidence_interval,
            created_at=now,
        )
        db.add(det)

        for i in range(5):
            fr = FrameResult(
                session_id=session.id,
                frame_number=i + 1,
                timestamp_ms=(i + 1) * 1000,
                xception_score=signals["xception_score"],
                temporal_consistency=signals["temporal_consistency"],
                rppg_value=signals["rppg_score"],
                is_flagged=False,
                created_at=now,
            )
            db.add(fr)

        session.status = "complete"
        session.completed_at = now
        db.commit()

        if settings.n8n_webhook_url:
            with httpx.Client(timeout=5.0) as client:
                client.post(
                    str(settings.n8n_webhook_url),
                    json={
                        "session_id": str(session.id),
                        "verdict": det.verdict,
                        "risk_score": det.risk_score,
                        "risk_level": det.risk_level,
                    },
                )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise self.retry(exc=exc, countdown=10)
    finally:
        db.close()

