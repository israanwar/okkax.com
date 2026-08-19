"""Unit tests for R2 Storage, Media Enrichment (Spotify, YouTube), and E-Signature."""

import asyncio
from pathlib import Path
import sys
import pytest

# Ensure backend root is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from integrations.exceptions import ProviderNotConfigured
from integrations.media.spotify_client import SpotifyClient
from integrations.media.youtube_client import YouTubeClient
from integrations.signatures.esign_client import ESignDocumentRequest, PrivyESignProvider
from integrations.storage.r2_client import R2StorageClient


class TestR2StorageAdapter:
    def test_presigned_upload_url_security_and_validation(self):
        client = R2StorageClient(enabled=False)

        # 1. Valid PDF upload URL
        res = client.generate_presigned_upload_url(
            organization_id="org_test_01",
            resource_type="invoices",
            resource_id="inv_2026_001",
            filename="Invoice-Aruna.pdf",
            content_type="application/pdf",
            size_bytes=1024 * 1024,  # 1 MB
        )
        assert res.ok is True
        assert "upload_url" in res.data
        assert "object_key" in res.data
        assert res.data["object_key"].endswith(".pdf")
        assert "org_test_01/invoices/inv_2026_001/" in res.data["object_key"]

        # 2. Invalid MIME type rejection
        res_mime = client.generate_presigned_upload_url(
            organization_id="org_test_01",
            resource_type="invoices",
            resource_id="inv_2026_001",
            filename="malicious.exe",
            content_type="application/x-msdownload",
            size_bytes=1000,
        )
        assert res_mime.ok is False
        assert res_mime.error_code == "INVALID_MIME_TYPE"

        # 3. Oversized file rejection
        res_size = client.generate_presigned_upload_url(
            organization_id="org_test_01",
            resource_type="avatars",
            resource_id="usr_01",
            filename="avatar.png",
            content_type="image/png",
            size_bytes=50 * 1024 * 1024,  # 50 MB > 5MB limit
        )
        assert res_size.ok is False
        assert res_size.error_code == "FILE_TOO_LARGE"

    def test_presigned_download_url_path_traversal_defense(self):
        client = R2StorageClient(enabled=False)

        # 1. Valid path
        res = client.generate_presigned_download_url("production/org_01/invoices/inv_01/file.pdf")
        assert res.ok is True
        assert "download_url" in res.data

        # 2. Path traversal blocked
        res_traversal = client.generate_presigned_download_url("../../../etc/passwd")
        assert res_traversal.ok is False
        assert res_traversal.error_code == "INVALID_PATH"


class TestMediaEnrichmentAdapters:
    def test_spotify_artist_search(self):
        async def _test():
            client = SpotifyClient(enabled=False)

            res = await client.search_artist("Aksara Band")
            assert res.ok is True
            data = res.data
            assert data["artist_name"] == "Aksara Band"
            assert "genres" in data
            assert "popularity_index" in data

            # Empty query rejection
            res_err = await client.search_artist("")
            assert res_err.ok is False
            assert res_err.error_code == "INVALID_ARTIST"

        asyncio.run(_test())

    def test_youtube_showreels_search(self):
        async def _test():
            client = YouTubeClient(enabled=False)

            res = await client.search_showreels("Aruna Live Concert", limit=2)
            assert res.ok is True
            assert isinstance(res.data, list)
            assert len(res.data) > 0
            showreel = res.data[0]
            assert "video_id" in showreel
            assert "embed_url" in showreel

            # Empty query rejection
            res_err = await client.search_showreels("")
            assert res_err.ok is False
            assert res_err.error_code == "INVALID_QUERY"

        asyncio.run(_test())


class TestESignatureContract:
    def test_esignature_not_configured_by_default(self):
        async def _test():
            client = PrivyESignProvider()
            assert client.is_configured() is False

            health = await client.health_check()
            assert health.ok is False
            assert health.error_code == "NOT_CONFIGURED"

            req = ESignDocumentRequest(
                document_id="doc_01",
                document_title="Kontrak Talent",
                document_pdf_url="https://storage.okkax.com/doc_01.pdf",
                signers=[{"name": "Budi", "email": "budi@okkax.com", "role": "Organizer"}],
            )
            with pytest.raises(ProviderNotConfigured):
                await client.request_signature(req)

        asyncio.run(_test())
