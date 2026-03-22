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
            self.ai_detector = AIImageDetector()
            from ml.mock_service import MockRPPGExtractor, MockAASSISTDetector, MockTemporalScorer, MockChallengeEngine
            self.rppg = MockRPPGExtractor()
            self.audio = MockAASSISTDetector()
            self.temporal = MockTemporalScorer()
            self.challenge = MockChallengeEngine()
        self.risk_scorer = RiskScorer()

    def run_full_pipeline(self, frames: List[Any] | None = None, audio_path: str = "") -> Dict[str, Any]:
        """Run all detectors and return unified signals."""
        if not frames or not isinstance(frames[0], np.ndarray):
            frames = [np.zeros((256, 256, 3), dtype=np.uint8) for _ in range(5)]

        frame = frames[0]
        
        # Run MesoNet (face swap detection)
        mesonet_result = self.deepfake_detector.predict_frame(frame)
        mesonet_score = float(mesonet_result["score"])
        
        # Run AI Image Detector (StyleGAN, Gemini detection)
        ai_result = self.ai_detector.predict_frame(frame)
        ai_score = float(ai_result["score"])
        
        # Combined score - take the higher of the two
        combined_score = max(mesonet_score, ai_score)

        print(f"DEBUG MesoNet score: {mesonet_score:.4f}")
        print(f"DEBUG AI detector score: {ai_score:.4f}")  
        print(f"DEBUG Combined score: {combined_score:.4f}")

        signals = {
            "xception_score": combined_score,
            "mesonet_score": mesonet_score,
            "ai_score": ai_score,
        }

        risk = self.risk_scorer.compute_risk(signals)
        return {"signals": signals, "risk": risk}

