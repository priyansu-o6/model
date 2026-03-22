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
from app.services.storage import MEDIA_BUCKET, MinioStorageService
from workers.celery_app import app as celery_app
import os
import tempfile
import cv2
import numpy as np
from ml.deepfake.gradcam import MesoNetGradCAM
import base64
import io
from PIL import Image as PILImage

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

        frames = []
        if media_path:
            try:
                storage = MinioStorageService()
                media_bytes = storage.download_file(MEDIA_BUCKET, media_path)
                
                ext = media_path.split('.')[-1].lower() if '.' in media_path else ''
                if ext in ['mp4', 'webm', 'mov', 'avi']:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as temp_file:
                        temp_file.write(media_bytes)
                        temp_file_path = temp_file.name
                    try:
                        cap = cv2.VideoCapture(temp_file_path)
                        for _ in range(5):
                            ret, frame = cap.read()
                            if ret:
                                frames.append(frame)
                            else:
                                break
                        cap.release()
                    finally:
                        if os.path.exists(temp_file_path):
                            os.remove(temp_file_path)
                else:
                    np_arr = np.frombuffer(media_bytes, np.uint8)
                    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                    if img is not None:
                        frames = [img] * 5
            except Exception as e:
                import traceback
                print(f"Error extracting frames: {e}")
                print(traceback.format_exc())

        print(f"DEBUG: media_path = {media_path}")
        print(f"DEBUG: frames extracted = {len(frames)}")
        if frames:
            print(f"DEBUG: first frame shape = {frames[0].shape if hasattr(frames[0], 'shape') else type(frames[0])}")
        else:
            print("DEBUG: NO FRAMES EXTRACTED")

        detection_service = DetectionService()
        pipeline_result = detection_service.run_full_pipeline(frames=frames, audio_path=media_path)
        signals = pipeline_result["signals"]
        risk_result = pipeline_result["risk"]

        gradcam_base64 = None
        suspicious_regions_list = None
        
        try:
            if frames and not settings.use_mock_models:
                from ml.deepfake.mesonet import MesoNetDetector
                _mesonet = MesoNetDetector()
                _gradcam = MesoNetGradCAM(_mesonet)
                gradcam_result = _gradcam.analyze(frames[0])
                
                if gradcam_result["overlay"] is not None:
                    pil_img = PILImage.fromarray(gradcam_result["overlay"])
                    buffer = io.BytesIO()
                    pil_img.save(buffer, format="JPEG")
                    gradcam_base64 = base64.b64encode(
                        buffer.getvalue()
                    ).decode()
                
                if gradcam_result["suspicious_regions"]:
                    suspicious_regions_list = gradcam_result["suspicious_regions"]
        except Exception as e:
            print(f"GradCAM failed (non-critical): {e}")

        now = datetime.now(timezone.utc)
        det = DetectionResult(
            session_id=session.id,
            verdict=risk_result.verdict,
            risk_score=risk_result.risk_score,
            risk_level=risk_result.risk_level,
            xception_score=signals.get("xception_score"),
            temporal_score=None,
            rppg_score=None,
            liveness_score=None,
            audio_score=None,
            gradcam_path=gradcam_base64,
            suspicious_regions=suspicious_regions_list,
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
                xception_score=signals.get("xception_score"),
                temporal_consistency=None,
                rppg_value=None,
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
