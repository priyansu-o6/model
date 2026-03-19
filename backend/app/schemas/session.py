from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class FrameResultSchema(BaseModel):
    """Per-frame metrics for a verification session."""

    id: UUID
    session_id: UUID
    frame_number: int
    timestamp_ms: int
    xception_score: Optional[float] = None
    temporal_consistency: Optional[float] = None
    rppg_value: Optional[float] = None
    is_flagged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SessionSchema(BaseModel):
    """Core verification session details."""

    id: UUID
    user_id: UUID
    mode: str
    status: str
    subject_name: Optional[str] = None
    media_path: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None

    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    """Paginated list of sessions."""

    items: List[SessionSchema]
    total: int
    page: int
    limit: int


class DashboardStatsSchema(BaseModel):
    """Aggregate analytics for dashboard views."""

    total_sessions: int
    authentic_count: int
    deepfake_count: int
    suspicious_count: int
    average_risk_score: float

