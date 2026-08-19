"""Cloud Storage and Object CDN Package."""

from .r2_client import R2StorageClient, storage_client

__all__ = [
    "R2StorageClient",
    "storage_client",
]
