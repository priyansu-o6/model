from __future__ import annotations

from sqlalchemy import Column, ForeignKey, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.types import DateTime

from db.database import Base


class AuditLog(Base):
    """Audit log entry capturing user actions for traceability and compliance."""

    __tablename__ = "audit_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(String, nullable=True)
    extra_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    def __repr__(self) -> str:
        """Return string representation for debugging."""
        return f"AuditLog(id={self.id!r}, user_id={self.user_id!r}, action={self.action!r})"