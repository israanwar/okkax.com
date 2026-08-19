"""Cloudflare R2 / AWS S3 Compatible Object Storage Client for OKKAX."""

import logging
import os
import re
import time
from typing import Any, Dict, Optional
import uuid

from ..base import BaseProvider, ProviderResult, current_iso
from ..config import settings
from ..exceptions import (
    ProviderAuthenticationError,
    ProviderNotConfigured,
    ProviderUnavailable,
)
from ..registry import registry

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

ALLOWED_RESOURCE_TYPES = {
    "posters",
    "riders",
    "invoices",
    "quotations",
    "contracts",
    "evidence",
    "avatars",
    "documents",
}

MAX_FILE_SIZES = {
    "avatars": 5 * 1024 * 1024,        # 5 MB
    "posters": 25 * 1024 * 1024,       # 25 MB
    "riders": 25 * 1024 * 1024,        # 25 MB
    "invoices": 15 * 1024 * 1024,      # 15 MB
    "quotations": 15 * 1024 * 1024,    # 15 MB
    "contracts": 20 * 1024 * 1024,     # 20 MB
    "evidence": 25 * 1024 * 1024,      # 25 MB
    "documents": 25 * 1024 * 1024,     # 25 MB
}


class R2StorageClient(BaseProvider):
    """Client for generating secure presigned S3/R2 upload and download URLs."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        account_id: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        bucket: Optional[str] = None,
        endpoint: Optional[str] = None,
    ):
        super().__init__(
            name="r2_storage",
            enabled=enabled if enabled is not None else settings.STORAGE_ENABLED,
        )
        self.account_id = account_id if account_id is not None else settings.R2_ACCOUNT_ID
        self.access_key = access_key if access_key is not None else settings.R2_ACCESS_KEY_ID
        self.secret_key = secret_key if secret_key is not None else settings.R2_SECRET_ACCESS_KEY
        self.bucket = bucket if bucket is not None else settings.R2_BUCKET
        self.endpoint = endpoint if endpoint is not None else settings.R2_ENDPOINT

    def is_configured(self) -> bool:
        return bool(self.access_key and self.secret_key and self.bucket)

    def _get_s3_client(self):
        """Build S3 client for Cloudflare R2 or standard S3 endpoint."""
        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            raise ProviderNotConfigured("r2_storage", "boto3 library is required for live S3/R2 client operations")

        endpoint_url = self.endpoint
        if not endpoint_url and self.account_id:
            endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"

        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual" if endpoint_url and "r2" in endpoint_url else "auto"}),
            region_name="auto" if endpoint_url and "r2" in endpoint_url else "us-east-1",
        )

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("r2_storage", "DISABLED", "R2 storage provider is disabled in settings")
        if not self.is_configured():
            return ProviderResult.failure("r2_storage", "NOT_CONFIGURED", "R2 credentials missing")
        return ProviderResult.success("r2_storage", {"status": "configured", "bucket": self.bucket})

    def generate_presigned_upload_url(
        self,
        organization_id: str,
        resource_type: str,
        resource_id: str,
        filename: str,
        content_type: str,
        size_bytes: int,
        expiry_seconds: int = 900,  # 15 minutes
    ) -> ProviderResult:
        """Generate presigned PUT URL with strict security validations."""
        if content_type not in ALLOWED_MIME_TYPES:
            return ProviderResult.failure(
                "r2_storage",
                "INVALID_MIME_TYPE",
                f"MIME type '{content_type}' is not allowed. Allowed: {list(ALLOWED_MIME_TYPES.keys())}",
            )

        res_type_clean = resource_type.strip().lower()
        if res_type_clean not in ALLOWED_RESOURCE_TYPES:
            return ProviderResult.failure(
                "r2_storage",
                "INVALID_RESOURCE_TYPE",
                f"Resource type '{resource_type}' is not allowed.",
            )

        max_size = MAX_FILE_SIZES.get(res_type_clean, 25 * 1024 * 1024)
        if size_bytes > max_size:
            return ProviderResult.failure(
                "r2_storage",
                "FILE_TOO_LARGE",
                f"File size {size_bytes / (1024*1024):.1f}MB exceeds maximum limit of {max_size / (1024*1024):.1f}MB",
            )

        # Sanitize filename extension
        ext = ALLOWED_MIME_TYPES[content_type]
        file_uuid = uuid.uuid4().hex[:16]
        env = os.environ.get("OKKAX_ENV", "production")
        object_key = f"{env}/{organization_id}/{res_type_clean}/{resource_id}/{file_uuid}.{ext}"

        if not self.enabled or not self.is_configured():
            # Simulated URL for testing & local development
            simulated_upload_url = f"https://storage.local.okkax.com/upload/{object_key}?signature=simulated_sig"
            simulated_public_url = f"https://storage.local.okkax.com/{object_key}"
            return ProviderResult.success(
                "r2_storage",
                {
                    "upload_url": simulated_upload_url,
                    "object_key": object_key,
                    "public_url": simulated_public_url,
                    "expires_in_seconds": expiry_seconds,
                    "simulated": True,
                },
            )

        try:
            s3_client = self._get_s3_client()
            upload_url = s3_client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": object_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expiry_seconds,
            )
            return ProviderResult.success(
                "r2_storage",
                {
                    "upload_url": upload_url,
                    "object_key": object_key,
                    "expires_in_seconds": expiry_seconds,
                },
            )
        except Exception as e:
            logger.error(f"R2Storage: Failed to generate presigned upload URL: {e}")
            return ProviderResult.failure("r2_storage", "PRESIGN_FAILED", str(e)[:150])

    def generate_presigned_download_url(
        self,
        object_key: str,
        expiry_seconds: int = 1800,  # 30 minutes
    ) -> ProviderResult:
        """Generate presigned GET URL for secure document access."""
        # Sanitize path traversal attempts
        if ".." in object_key or object_key.startswith("/"):
            return ProviderResult.failure("r2_storage", "INVALID_PATH", "Path traversal in object key is forbidden")

        if not self.enabled or not self.is_configured():
            simulated_url = f"https://storage.local.okkax.com/download/{object_key}?signature=simulated_sig"
            return ProviderResult.success(
                "r2_storage",
                {"download_url": simulated_url, "object_key": object_key, "simulated": True},
            )

        try:
            s3_client = self._get_s3_client()
            download_url = s3_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket, "Key": object_key},
                ExpiresIn=expiry_seconds,
            )
            return ProviderResult.success(
                "r2_storage",
                {"download_url": download_url, "object_key": object_key, "expires_in_seconds": expiry_seconds},
            )
        except Exception as e:
            logger.error(f"R2Storage: Failed to generate presigned download URL: {e}")
            return ProviderResult.failure("r2_storage", "PRESIGN_FAILED", str(e)[:150])


storage_client = R2StorageClient()
registry.register(storage_client)
