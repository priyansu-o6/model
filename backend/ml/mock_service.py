from __future__ import annotations

import random
from typing import Any

import numpy as np


class MockXceptionDetector:
    """Mock frame-level deepfake detector."""

    def predict_frame(self, frame: Any) -> dict[str, Any]:
        """Return a randomized detection score and blank Grad-CAM map."""
        score = random.uniform(0.0, 1.0)
        gradcam_map = np.zeros((224, 224), dtype=np.float32)
        return {"score": score, "gradcam_map": gradcam_map}


class MockRPPGExtractor:
    """Mock remote photoplethysmography (rPPG) signal extractor."""

    def extract_from_frames(self, frames: list[Any]) -> dict[str, Any]:
        """Return randomized heart-rate and liveness signal."""
        bpm = random.uniform(60.0, 100.0)
        signal = [random.uniform(-1.0, 1.0) for _ in range(128)]
        liveness_score = random.uniform(0.0, 1.0)
        return {"bpm": bpm, "signal": signal, "liveness_score": liveness_score}


class MockAASSISTDetector:
    """Mock audio anti-spoofing detector."""

    _ATTACK_TYPES = ["none", "tts", "replay"]

    def analyze_audio(self, audio_path: str) -> dict[str, Any]:
        """Return randomized audio spoofing assessment."""
        score = random.uniform(0.0, 1.0)
        is_spoofed = score > 0.6
        attack_type = random.choice(self._ATTACK_TYPES)
        if not is_spoofed:
            attack_type = "none"
        return {"is_spoofed": is_spoofed, "score": score, "attack_type": attack_type}


class MockChallengeEngine:
    """Mock active liveness challenge engine."""

    _CHALLENGES = ["blink_twice", "turn_left", "turn_right", "smile", "nod"]

    def generate_challenge(self) -> dict[str, str]:
        """Return a random liveness challenge."""
        challenge = random.choice(self._CHALLENGES)
        return {"challenge": challenge}

    def verify_response(self, frames: list[Any], challenge: dict[str, str]) -> dict[str, Any]:
        """Return randomized verification outcome for a challenge response."""
        confidence = random.uniform(0.7, 1.0)
        passed = confidence > 0.8
        return {"passed": passed, "confidence": confidence}


class MockTemporalScorer:
    """Mock temporal consistency scorer across frames."""

    def score_frames(self, frames: list[Any]) -> dict[str, Any]:
        """Return randomized temporal consistency metrics."""
        consistency_score = random.uniform(0.0, 1.0)
        per_frame_scores = [random.uniform(0.0, 1.0) for _ in frames] or [consistency_score]
        return {"consistency_score": consistency_score, "per_frame_scores": per_frame_scores}

