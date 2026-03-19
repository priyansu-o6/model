from __future__ import annotations

from typing import Any, Dict, List

from app.config import get_settings
from app.services.risk_scoring import RiskScorer
from ml.mock_service import (
    MockAASSISTDetector,
    MockRPPGExtractor,
    MockTemporalScorer,
    MockXceptionDetector,
)


class DetectionService:
    """Detection pipeline orchestrator that switches between mock and real models."""

    def __init__(self) -> None:
        settings = get_settings()
        self.use_mock = settings.use_mock_models
        if self.use_mock:
            self.x_model = MockXceptionDetector()
            self.rppg = MockRPPGExtractor()
            self.temporal = MockTemporalScorer()
            self.audio = MockAASSISTDetector()
        else:
            raise NotImplementedError("Real models not yet loaded")
        self.risk_scorer = RiskScorer()

    def run_full_pipeline(self, frames: List[Any] | None = None, audio_path: str = "") -> Dict[str, Any]:
        """Run all detectors and return unified signals."""
        if frames is None or not frames:
            frames = [object() for _ in range(5)]

        x_scores = [float(self.x_model.predict_frame(f)["score"]) for f in frames]
        xception_score = sum(x_scores) / len(x_scores)

        rppg_result = self.rppg.extract_from_frames(frames)
        temporal_result = self.temporal.score_frames(frames)
        audio_result = self.audio.analyze_audio(audio_path)

        signals = {
            "xception_score": xception_score,
            "temporal_consistency": float(temporal_result["consistency_score"]),
            "rppg_score": float(rppg_result["liveness_score"]),
            "liveness_score": float(rppg_result["liveness_score"]),
            "audio_score": float(audio_result["score"]),
        }

        risk = self.risk_scorer.compute_risk(signals)
        return {"signals": signals, "risk": risk}

