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

    mesonet = MesoNetDetector()
    rppg = MockRPPGExtractor()
    temporal = MockTemporalScorer()
    audio = MockAASSISTDetector()
    challenge_engine = MockChallengeEngine()
    scorer = RiskScorer()

    def crop_face(frame):
        h, w = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(
            cv2.resize(frame, (300, 300)), 1.0,
            (300, 300), (104.0, 177.0, 123.0)
        )
        
        # Use OpenCV's built-in face detector
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Try with relaxed parameters for phone screens
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=3, 
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        if len(faces) > 0:
            x, y, w_f, h_f = faces[0]
            pad = int(0.3 * max(w_f, h_f))
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(w, x + w_f + pad)
            y2 = min(h, y + h_f + pad)
            return frame[y1:y2, x1:x2], True, (x, y, w_f, h_f)
        return frame, False, None

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
                        x_out = mesonet.predict_frame(cropped)
                        print(f"DEBUG WS: face_found={face_found} score={x_out['score']:.4f}")
                    else:
                        x_out = {"score": 1.0}
                        print(f"DEBUG WS: face_found=False, skipping MesoNet")
                else:
                    print(f"DEBUG WS: frame decode FAILED, raw={len(raw)} image={len(image_bytes)}")
                    x_out = {"score": 0.0}
            except Exception as e:
                print(f"DEBUG WS: exception {e}")
                break
            
            x_score = 1.0 - float(x_out.get("score", 0.0))
            frame_count += 1

            now_ts = asyncio.get_event_loop().time()
            if now_ts - last_result_time >= 0.5:
                rppg_result = rppg.extract_from_frames([])
                temporal_result = temporal.score_frames([])
                audio_result = audio.analyze_audio("")
                challenge_engine.verify_response([], None)  # result unused for now

                signals = {
                    "xception_score": x_score,
                }
                risk = scorer.compute_risk(signals)
                await manager.send_result(
                    session_id,
                    {
                        "xception_score": x_score,
                        "rppg_bpm": 0,
                        "risk_score": risk.risk_score,
                        "risk_level": risk.risk_level,
                        "verdict": risk.verdict,
                        "liveness_score": 0,
                        "audio_score": 0,
                        "temporal_score": 0,
                        "frame_count": frame_count,
                        "face_detected": face_found,
                        "face_box": {"x": face_box[0], "y": face_box[1], "w": face_box[2], "h": face_box[3]} if face_found and face_box else None,
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

