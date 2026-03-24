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
)
import numpy as np
import cv2
from ml.deepfake.mesonet import MesoNetDetector
from ml.liveness.rppg_extractor import RPPGExtractor
from ml.utils.face_detection import MediaPipeFaceDetector

# Module-level singletons - load once
_mesonet_instance = None
_rppg_instances: dict = {}
_face_detector_instance = None

def get_mesonet():
    global _mesonet_instance
    if _mesonet_instance is None:
        _mesonet_instance = MesoNetDetector()
    return _mesonet_instance

def get_rppg(session_id: str) -> RPPGExtractor:
    if session_id not in _rppg_instances:
        _rppg_instances[session_id] = RPPGExtractor(fps=15.0, window_seconds=3)
    return _rppg_instances[session_id]

def get_face_detector() -> MediaPipeFaceDetector:
    global _face_detector_instance
    if _face_detector_instance is None:
        _face_detector_instance = MediaPipeFaceDetector()
    return _face_detector_instance

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

    try:
        mesonet = get_mesonet()
        rppg = get_rppg(session_id)
        temporal = MockTemporalScorer()
        audio = MockAASSISTDetector()
        challenge_engine = MockChallengeEngine()
        scorer = RiskScorer()
        face_detector = get_face_detector()
    except Exception as e:
        print(f"[WS INIT ERROR] failed to initialize models: {e}")
        import traceback; traceback.print_exc()
        await websocket.close()
        return

    def crop_face(frame):
        return face_detector.detect_face(frame)

    rppg_result = {"bpm": 0.0, "liveness_score": 0.5, "ready": False}

    try:
        while True:
            face_found = False
            face_box = None
            try:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    break
                
                raw = message.get("bytes") or message.get("text", "").encode()
                
                # Find the newline separator between metadata and image bytes
                newline_pos = raw.find(b"\n")
                if newline_pos != -1:
                    image_bytes = raw[newline_pos + 1:]
                else:
                    image_bytes = raw
                
                # Decode image
                np_arr = np.frombuffer(image_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                if frame is not None:
                    cropped, face_found, face_box = crop_face(frame)
                    if face_found:
                        rppg.add_frame(cropped)
                        x_out = mesonet.predict_frame(cropped)
                    else:
                        rppg.reset()  # clear bad data instead of polluting buffer
                        x_out = {"score": 1.0}
                else:
                    x_out = {"score": 0.0}
            except Exception as e:
                print(f"[WS ERROR] frame processing error: {e}")
                import traceback; traceback.print_exc()
                continue
            
            x_score = 1.0 - float(x_out.get("score", 0.0))
            frame_count += 1
            
            rppg_result = rppg.compute_bpm()

            now_ts = asyncio.get_event_loop().time()
            if now_ts - last_result_time >= 0.5:
                temporal_result = temporal.score_frames([])
                audio_result = audio.analyze_audio("")
                challenge_engine.verify_response([], None)  # result unused for now

                signals = {
                    "xception_score": x_score,
                    "rppg_score": rppg_result.get("liveness_score", 0.5)
                }
                risk = scorer.compute_risk(signals)
                try:
                    await manager.send_result(
                        session_id,
                        {
                            "xception_score": float(x_score),
                            "rppg_bpm": float(rppg_result.get("bpm", 0.0)),
                            "risk_score": float(risk.risk_score),
                            "risk_level": str(risk.risk_level),
                            "verdict": str(risk.verdict),
                            "liveness_score": float(rppg_result.get("liveness_score", 0.5)),
                            "rppg_ready": bool(rppg_result.get("ready", False)),
                            "audio_score": 0.0,
                            "temporal_score": 0.0,
                            "frame_count": int(frame_count),
                            "face_detected": bool(face_found),
                            "face_box": {
                                "x": int(face_box[0]), 
                                "y": int(face_box[1]), 
                                "w": int(face_box[2]), 
                                "h": int(face_box[3])
                            } if face_found and face_box else None,
                        },
                    )
                    last_result_time = now_ts
                except Exception as e:
                    print(f"[WS SEND ERROR] {e}")
                    import traceback; traceback.print_exc()
                    break

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
        # Don't clean up rppg here - keep it for reconnections


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

