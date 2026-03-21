from __future__ import annotations

from typing import Any, Dict, List

import numpy as np

from app.config import get_settings
from app.services.risk_scoring import RiskScorer
from ml.deepfake.mesonet import MesoNetDetector


class DetectionService:
    """Detection pipeline orchestrator that switches between mock and real models."""

    def __init__(self) -> None:
        settings = get_settings()
        if settings.use_mock_models:
            from ml.mock_service import MockXceptionDetector, MockRPPGExtractor, MockAASSISTDetector, MockTemporalScorer, MockChallengeEngine
            self.deepfake_detector = MockXceptionDetector()
            self.rppg = MockRPPGExtractor()
            self.audio = MockAASSISTDetector()
            self.temporal = MockTemporalScorer()
            self.challenge = MockChallengeEngine()
        else:
            self.deepfake_detector = MesoNetDetector()
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
        deepfake_result = self.deepfake_detector.predict_frame(frame)
        xception_score = float(deepfake_result["score"])

        signals = {
            "xception_score": xception_score,
        }

        risk = self.risk_scorer.compute_risk(signals)
        return {"signals": signals, "risk": risk}

