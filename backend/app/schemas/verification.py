from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class UploadMediaRequest(BaseModel):
    """Request payload for media upload verification."""

    subject_name: Optional[str] = None


class UploadMediaResponse(BaseModel):
    """Response after initiating an upload-based verification."""

    session_id: UUID
    media_url: HttpUrl


class StartLiveSessionRequest(BaseModel):
    """Request payload for starting a live verification session."""

    subject_name: str | None = None


class StartLiveSessionResponse(BaseModel):
    """Response with newly created live session metadata."""

    session_id: UUID
    websocket_url: HttpUrl


class SuspiciousRegionSchema(BaseModel):
    """Region in the media flagged as suspicious."""

    x: int
    y: int
    width: int
    height: int
    description: Optional[str] = None


class RiskScoreSchema(BaseModel):
    """Risk scoring details for a verification session."""

    risk_score: float
    risk_level: str
    explanation_reasons: List[str]
    confidence_interval: List[float]
    verdict: str


class DetectionResultSchema(BaseModel):
    """Full detection result as exposed via the API."""

    id: UUID
    session_id: UUID
    verdict: str
    risk_score: float
    risk_level: str
    xception_score: Optional[float] = None
    temporal_score: Optional[float] = None
    rppg_score: Optional[float] = None
    liveness_score: Optional[float] = None
    audio_score: Optional[float] = None
    gradcam_path: Optional[str] = None
    suspicious_regions: Optional[List[SuspiciousRegionSchema]] = None
    explanation_reasons: Optional[List[str]] = None
    confidence_interval: Optional[List[float]] = None
    created_at: datetime

    class Config:
        from_attributes = True

