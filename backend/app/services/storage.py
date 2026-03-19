from __future__ import annotations

from datetime import timedelta
from typing import BinaryIO, Optional

from minio import Minio

from app.config import get_settings


class MinioStorageService:
    """Wrapper around MinIO client for media, heatmaps, and reports."""

    def __init__(self) -> None:
        settings = get_settings()
        self._client = Minio(
            settings.minio_endpoint.replace("http://", "").replace("https://", ""),
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_endpoint.startswith("https"),
        )

    def _ensure_bucket(self, bucket: str) -> None:
        if not self._client.bucket_exists(bucket):
            self._client.make_bucket(bucket)

    def upload_file(self, file_obj: BinaryIO, bucket: str, path: str, content_type: str | None = None) -> str:
        """Upload a file-like object to MinIO and return its object path."""
        self._ensure_bucket(bucket)
        self._client.put_object(bucket, path, file_obj, length=-1, part_size=10 * 1024 * 1024, content_type=content_type)
        return path

    def download_file(self, bucket: str, path: str) -> bytes:
        """Download an object from MinIO and return its bytes."""
        response = self._client.get_object(bucket, path)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def delete_file(self, bucket: str, path: str) -> None:
        """Delete an object from MinIO."""
        self._client.remove_object(bucket, path)

    def generate_presigned_url(self, bucket: str, path: str, expiry: int = 3600) -> str:
        """Generate a presigned URL with the given expiry in seconds."""
        return self._client.presigned_get_object(bucket, path, expires=timedelta(seconds=expiry))


MEDIA_BUCKET = "media"
HEATMAP_BUCKET = "heatmaps"
REPORT_BUCKET = "reports"

