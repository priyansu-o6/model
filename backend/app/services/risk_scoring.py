from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple


@dataclass
class RiskScoreResult:
    """Container for risk scoring output."""

    risk_score: float
    risk_level: str
    explanation_reasons: List[str]
    confidence_interval: List[float]
    verdict: str


class RiskScorer:
    """Fuse multiple model signals into a single risk score and verdict."""

    WEIGHTS: Dict[str, float] = {
        "xception_score": 1.0,
    }

    THRESHOLDS: Dict[str, Tuple[float, float]] = {
        "low": (0.0, 30.0),
        "medium": (30.0, 60.0),
        "high": (60.0, 80.0),
        "critical": (80.0, 100.0),
    }

    def compute_risk(self, signals: Dict[str, Any]) -> RiskScoreResult:
        """Compute fused risk score, level, explanations, interval, and verdict."""
        normalized: Dict[str, float] = {}
        raw_value = float(signals.get("xception_score", 0.5) or 0.5)
        normalized["xception_score"] = max(0.0, min(raw_value, 1.0))

        risk_score = float(signals.get("xception_score", 0.5)) * 100
        risk_score = round(risk_score, 2)

        risk_level = self._determine_level(risk_score)
        verdict = self._determine_verdict(risk_level)
        explanation_reasons = self._build_explanations(normalized, risk_score, risk_level)
        confidence_interval = self._compute_confidence_interval(risk_score)

        return RiskScoreResult(
            risk_score=risk_score,
            risk_level=risk_level,
            explanation_reasons=explanation_reasons,
            confidence_interval=confidence_interval,
            verdict=verdict,
        )

    def _determine_level(self, risk_score: float) -> str:
        for level, (low, high) in self.THRESHOLDS.items():
            if low <= risk_score < high:
                return level
        return "critical"

    def _determine_verdict(self, risk_level: str) -> str:
        if risk_level == "low":
            return "authentic"
        if risk_level == "medium":
            return "suspicious"
        return "deepfake"

    def _build_explanations(self, normalized: Dict[str, float], risk_score: float, risk_level: str) -> List[str]:
        reasons: List[str] = [f"Overall risk score {risk_score:.1f} classified as {risk_level}."]

        for signal, value in normalized.items():
            if value >= 0.7:
                reasons.append(f"{signal} indicates strong deepfake likelihood (score={value:.2f}).")
            elif value >= 0.4:
                reasons.append(f"{signal} is moderately suspicious (score={value:.2f}).")
            else:
                reasons.append(f"{signal} appears benign (score={value:.2f}).")

        return reasons

    def _compute_confidence_interval(self, risk_score: float) -> List[float]:
        margin = max(3.0, min(10.0, 100.0 - abs(50.0 - risk_score) / 2.0))
        lower = max(0.0, risk_score - margin)
        upper = min(100.0, risk_score + margin)
        return [round(lower, 2), round(upper, 2)]

