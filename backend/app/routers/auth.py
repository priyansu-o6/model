from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db_session
from app.models import User


router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _get_redis_client() -> aioredis.Redis:
    settings = get_settings()
    return aioredis.from_url(settings.redis_url)


def _create_token(data: dict[str, Any], expires_delta: timedelta, token_type: str) -> str:
    settings = get_settings()
    to_encode = data.copy()
    to_encode["type"] = token_type
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Validate credentials and issue access + refresh tokens."""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    if user is None or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    access_token_expires = timedelta(minutes=30)
    refresh_token_expires = timedelta(days=7)

    payload = {"sub": str(user.id)}
    access_token = _create_token(payload, access_token_expires, token_type="access")
    refresh_token = _create_token(payload, refresh_token_expires, token_type="refresh")

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/refresh")
async def refresh_token(body: dict[str, str]) -> dict[str, Any]:
    """Accept a refresh token and issue a new access token."""
    settings = get_settings()
    token = body.get("refresh_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing refresh_token.")

    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token type.")
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing subject.")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    access_token_expires = timedelta(minutes=30)
    access_token = _create_token({"sub": user_id}, access_token_expires, token_type="access")
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(token: str = Depends(oauth2_scheme)) -> None:
    """Blacklist the current access token in Redis until it expires."""
    settings = get_settings()
    client = _get_redis_client()
    try:
        unverified = jwt.get_unverified_claims(token)
        exp = unverified.get("exp")
        if exp is None:
            ttl = 1800
        else:
            now_ts = datetime.now(timezone.utc).timestamp()
            ttl = max(1, int(exp - now_ts))
    except Exception:
        ttl = 1800

    await client.setex(f"blacklist:{token}", ttl, "1")


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    """Return current user profile."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "organization": current_user.organization,
        "is_active": current_user.is_active,
    }

