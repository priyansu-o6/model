from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db_session
from app.models import DetectionResult, VerificationSession
from app.schemas.verification import DetectionResultSchema, StartLiveSessionRequest
from app.services.risk_scoring import RiskScorer
from app.services.storage import MEDIA_BUCKET, MinioStorageService
from ml.mock_service import MockXceptionDetector
from workers.celery_app import app as celery_app


router = APIRouter()
TEST_USER_ID = UUID("da11c5eb-1d2e-417e-98fd-ff1369ef24ce")

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "video/mp4",
    "video/webm",
    "audio/wav",
    "audio/mpeg",
}


@router.post("/upload")
async def upload_verification_media(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Upload media, create a verification session, trigger async analysis."""
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported media type.")

    storage = MinioStorageService()
    object_key = f"{uuid4()}/{file.filename}"
    storage.upload_file(file.file, MEDIA_BUCKET, object_key, content_type=file.content_type)

    session = VerificationSession(
        user_id=TEST_USER_ID,
        mode="upload",
        status="pending",
        subject_name=None,
        media_path=object_key,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    celery_app.send_task("tasks.analyze_video", args=[str(session.id), object_key])

    return {"session_id": str(session.id), "status": "pending"}


@router.post("/start-live")
async def start_live_session(
    payload: StartLiveSessionRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Create a live verification session and return websocket URL."""
    session = VerificationSession(
        user_id=TEST_USER_ID,
        mode="live",
        status="pending",
        subject_name=payload.subject_name,
        media_path=None,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    websocket_url = f"ws://localhost:8000/ws/live/{session.id}"
    return {"session_id": str(session.id), "websocket_url": websocket_url}


@router.delete("/end-live/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def end_live_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Mark a live session as complete and set duration."""
    result = await db.execute(select(VerificationSession).where(VerificationSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    now = datetime.now(timezone.utc)
    session.status = "complete"
    session.completed_at = now
    if session.started_at is not None:
        session.duration_seconds = int((now - session.started_at).total_seconds())
    await db.commit()
    from workers.tasks.video_analysis import analyze_video_task

    analyze_video_task.delay(str(session_id), "")


@router.post("/sync", response_model=DetectionResultSchema)
async def sync_verification(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
) -> DetectionResultSchema:
    """Run synchronous mock detection, persist result, and return it."""
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported media type.")

    x_model = MockXceptionDetector()
    scorer = RiskScorer()

    prediction = x_model.predict_frame(None)
    x_score = float(prediction["score"])

    signals = {
        "xception_score": x_score,
        "temporal_consistency": 0.5,
        "rppg_score": 0.5,
        "liveness_score": 0.5,
        "audio_score": 0.5,
    }
    risk = scorer.compute_risk(signals)

    now = datetime.now(timezone.utc)
    session = VerificationSession(
        user_id=TEST_USER_ID,
        mode="upload",
        status="complete",
        subject_name=None,
        media_path=None,
        started_at=now,
        completed_at=now,
        duration_seconds=0,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    det = DetectionResult(
        session_id=session.id,
        verdict=risk.verdict,
        risk_score=risk.risk_score,
        risk_level=risk.risk_level,
        xception_score=signals["xception_score"],
        temporal_score=signals["temporal_consistency"],
        rppg_score=signals["rppg_score"],
        liveness_score=signals["liveness_score"],
        audio_score=signals["audio_score"],
        gradcam_path=None,
        suspicious_regions=None,
        explanation_reasons=risk.explanation_reasons,
        confidence_interval=risk.confidence_interval,
        created_at=now,
    )
    db.add(det)
    await db.commit()
    await db.refresh(det)

    return DetectionResultSchema.model_validate(det)

