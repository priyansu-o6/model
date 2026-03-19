from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session, log_audit
from app.models import DetectionResult, FrameResult, VerificationSession
from app.schemas.session import DashboardStatsSchema
from app.services.risk_scoring import RiskScorer
from app.websocket.manager import manager
from ml.mock_service import (
    MockAASSISTDetector,
    MockChallengeEngine,
    MockRPPGExtractor,
    MockTemporalScorer,
    MockXceptionDetector,
)


router = APIRouter()


@router.websocket("/ws/live/{session_id}")
async def websocket_live(
    websocket: WebSocket,
    session_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Handle live WebSocket stream for a verification session."""
    await manager.connect(websocket, session_id)
    frame_count = 0
    last_result_time = asyncio.get_event_loop().time()

    x_model = MockXceptionDetector()
    rppg = MockRPPGExtractor()
    temporal = MockTemporalScorer()
    audio = MockAASSISTDetector()
    challenge_engine = MockChallengeEngine()
    scorer = RiskScorer()

    try:
        while True:
            data = await websocket.receive_bytes()
            frame_count += 1

            x_out = x_model.predict_frame(None)
            x_score = float(x_out["score"])

            now_ts = asyncio.get_event_loop().time()
            if now_ts - last_result_time >= 0.5:
                rppg_result = rppg.extract_from_frames([])
                temporal_result = temporal.score_frames([])
                audio_result = audio.analyze_audio("")
                challenge_engine.verify_response([], None)  # result unused for now

                signals = {
                    "xception_score": x_score,
                    "temporal_consistency": float(temporal_result["consistency_score"]),
                    "rppg_score": float(rppg_result["liveness_score"]),
                    "liveness_score": float(rppg_result["liveness_score"]),
                    "audio_score": float(audio_result["score"]),
                }
                risk = scorer.compute_risk(signals)

                await manager.send_result(
                    session_id,
                    {
                        "xception_score": signals["xception_score"],
                        "rppg_bpm": float(rppg_result["bpm"]),
                        "risk_score": risk.risk_score,
                        "risk_level": risk.risk_level,
                        "verdict": risk.verdict,
                        "liveness_score": signals["liveness_score"],
                        "audio_score": signals["audio_score"],
                        "temporal_score": signals["temporal_consistency"],
                        "frame_count": frame_count,
                    },
                )
                last_result_time = now_ts

            if frame_count % 5 == 0:
                fr = FrameResult(
                    session_id=UUID(session_id),
                    frame_number=frame_count,
                    timestamp_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                    xception_score=x_score,
                    temporal_consistency=None,
                    rppg_value=None,
                    is_flagged=False,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(fr)
                await db.commit()
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)


@router.get("/api/v1/analytics/dashboard", response_model=DashboardStatsSchema)
async def analytics_dashboard(
    db: AsyncSession = Depends(get_db_session),
) -> DashboardStatsSchema:
    """Return aggregate dashboard statistics."""
    total_sessions = (await db.execute(select(func.count(VerificationSession.id)))).scalar_one()
    authentic = (
        await db.execute(select(func.count(DetectionResult.id)).where(DetectionResult.verdict == "authentic"))
    ).scalar_one()
    deepfake = (
        await db.execute(select(func.count(DetectionResult.id)).where(DetectionResult.verdict == "deepfake"))
    ).scalar_one()
    suspicious = (
        await db.execute(select(func.count(DetectionResult.id)).where(DetectionResult.verdict == "suspicious"))
    ).scalar_one()
    avg_risk = (
        await db.execute(select(func.coalesce(func.avg(DetectionResult.risk_score), 0.0)))
    ).scalar_one()

    return DashboardStatsSchema(
        total_sessions=total_sessions,
        authentic_count=authentic,
        deepfake_count=deepfake,
        suspicious_count=suspicious,
        average_risk_score=float(avg_risk),
    )


@router.get("/api/v1/analytics/signals")
async def analytics_signals() -> dict[str, Any]:
    """Return hardcoded mock signal accuracy metrics."""
    return {
        "xception": {"accuracy": 0.93, "precision": 0.91, "recall": 0.90},
        "temporal": {"accuracy": 0.88, "precision": 0.86, "recall": 0.85},
        "rppg": {"accuracy": 0.87, "precision": 0.84, "recall": 0.83},
        "audio": {"accuracy": 0.89, "precision": 0.88, "recall": 0.86},
        "challenge": {"accuracy": 0.85, "precision": 0.82, "recall": 0.80},
    }


@router.post("/webhooks/kyc-result")
async def kyc_result_webhook(
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Receive KYC result webhook and log to audit."""
    await log_audit(
        db=db,
        user_id=None,
        action="kyc_result",
        resource_type="webhook",
        resource_id=None,
        ip_address=None,
    )
    return {"received": True}


@router.post("/webhooks/hiring-result")
async def hiring_result_webhook(
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Receive hiring result webhook and log to audit."""
    await log_audit(
        db=db,
        user_id=None,
        action="hiring_result",
        resource_type="webhook",
        resource_id=None,
        ip_address=None,
    )
    return {"received": True}

