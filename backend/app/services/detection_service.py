from __future__ import annotations

from typing import Any, Dict, List

import numpy as np

from app.config import get_settings
from app.services.risk_scoring import RiskScorer
from ml.deepfake.mesonet import MesoNetDetector
from ml.deepfake.ai_image_detector import AIImageDetector


class DetectionService:
    """Detection pipeline orchestrator that switches between mock and real models."""

    def __init__(self) -> None:
        settings = get_settings()
        if settings.use_mock_models:
            from ml.mock_service import MockXceptionDetector, MockRPPGExtractor, MockAASSISTDetector, MockTemporalScorer, MockChallengeEngine
            self.deepfake_detector = MockXceptionDetector()
            self.ai_detector = MockXceptionDetector()
            self.rppg = MockRPPGExtractor()
            self.audio = MockAASSISTDetector()
            self.temporal = MockTemporalScorer()
            self.challenge = MockChallengeEngine()
        else:
            self.deepfake_detector = MesoNetDetector()
            try:
                self.ai_detector = AIImageDetector()
            except Exception as e:
                print(f"AI detector failed to load: {e}")
                self.ai_detector = None
            from ml.mock_service import MockRPPGExtractor, MockAASSISTDetector, MockTemporalScorer, MockChallengeEngine
            self.rppg = MockRPPGExtractor()
            self.audio = MockAASSISTDetector()
            self.temporal = MockTemporalScorer()
            self.challenge = MockChallengeEngine()
        self.risk_scorer = RiskScorer()

    def run_full_pipeline(self, frames: List[Any] | None = None, audio_path: str = "", detection_mode: str = "faceswap") -> Dict[str, Any]:
        """Run all detectors and return unified signals."""
        if not frames or not isinstance(frames[0], np.ndarray):
            frames = [np.zeros((256, 256, 3), dtype=np.uint8) for _ in range(5)]

        frame = frames[0]
        
        if detection_mode == "aigenerated" and getattr(self, 'ai_detector', None):
            try:
                result1 = self.ai_detector.predict_frame(frame)
                
                from transformers import pipeline
                from PIL import Image
                import cv2
                
                detector2 = pipeline("image-classification", 
                    model="umm-maybe/AI-image-detector", device=-1)
                
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(rgb)
                result2 = detector2(pil_img)

                score2 = 0.5
                for r in result2:
                    if "artificial" in r["label"].lower():
                        score2 = float(r["score"])
                        break
                    elif "human" in r["label"].lower():
                        score2 = 1.0 - float(r["score"])
                        break

                combined_score = max(float(result1["score"]), score2)
                print(f"DEBUG SDXL score: {float(result1['score']):.4f} | ViT score: {score2:.4f} | Combined: {combined_score:.4f}")
            except Exception as e:
                print(f"DEBUG Dual-AI Error: {e}")
                combined_score = 0.0
        else:
            deepfake_result = self.deepfake_detector.predict_frame(frame)
            combined_score = 1.0 - float(deepfake_result.get("score", 0.0))
            self.last_cropped_frame = getattr(self.deepfake_detector, 'last_cropped_face', None)
            
        print(f"DEBUG mode={detection_mode} Final Extracted score: {combined_score:.4f}")

        signals = {
            "xception_score": combined_score,
        }

        risk = self.risk_scorer.compute_risk(signals)
        return {"signals": signals, "risk": risk}

