from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, Column, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import DateTime

from db.database import Base


class User(Base):
    """User account for the Pratyaksha platform."""

    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        nullable=False,
    )
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, server_default=text("'verifier'"))
    organization = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    is_active = Column(Boolean, nullable=False, server_default=text("TRUE"))

    def __repr__(self) -> str:
        """Return string representation for debugging."""
        return f"User(id={self.id!r}, email={self.email!r})"

