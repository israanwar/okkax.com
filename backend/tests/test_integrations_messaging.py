"""Unit and failure tests for Messaging adapters (Resend, WhatsApp, FCM)."""

import asyncio
from pathlib import Path
import sys
import pytest

# Ensure backend root is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from integrations.messaging.fcm_client import FCMClient
from integrations.messaging.resend_client import ResendEmailClient, _is_valid_email, _mask_email
from integrations.messaging.whatsapp_client import WhatsAppClient, mask_phone, normalize_phone_id


class TestResendEmailAdapter:
    def test_email_validation_and_masking(self):
        assert _is_valid_email("organizer@okkax.com") is True
        assert _is_valid_email("invalid-email") is False
        assert _is_valid_email("") is False

        assert _mask_email("organizer@okkax.com") == "o***r@okkax.com"
        assert _mask_email("ab@okkax.com") == "a***@okkax.com"

    def test_resend_simulated_and_idempotency(self):
        async def _test():
            client = ResendEmailClient(enabled=False)

            # Send email 1
            res1 = await client.send_email(
                to="buyer@okkax.com",
                subject="Tiket Konser Aruna Live 2026",
                html_content="<p>Tiket QR Pass Anda</p>",
                idempotency_key="idemp_order_12345",
            )
            assert res1.ok is True
            assert res1.data.get("simulated") is True

            # Invalid email rejection
            res_err = await client.send_email(
                to="not-an-email",
                subject="Error test",
                html_content="<p>Test</p>",
            )
            assert res_err.ok is False
            assert res_err.error_code == "INVALID_RECIPIENT"

        asyncio.run(_test())


class TestWhatsAppAdapter:
    def test_phone_normalization_and_masking(self):
        assert normalize_phone_id("081234567890") == "+6281234567890"
        assert normalize_phone_id("6281234567890") == "+6281234567890"
        assert normalize_phone_id("+6281234567890") == "+6281234567890"
        assert normalize_phone_id("0812-3456-7890") == "+6281234567890"

        assert mask_phone("081234567890") == "+62812****890"

    def test_whatsapp_simulated_and_duplicate_protection(self):
        async def _test():
            client = WhatsAppClient(enabled=False)

            # Send template 1
            res1 = await client.send_template(
                recipient="081234567890",
                template_key="ticket_issued",
                variables={"event_name": "Aruna Live", "ticket_id": "TKT-001"},
                reference_id="ref_ticket_001",
            )
            assert res1.ok is True
            assert res1.data.get("simulated") is True

            # Invalid phone rejection
            res_err = await client.send_template(
                recipient="12345",
                template_key="ticket_issued",
            )
            assert res_err.ok is False
            assert res_err.error_code == "INVALID_PHONE_NUMBER"

        asyncio.run(_test())


class TestFCMAdapter:
    def test_fcm_simulated_and_token_validation(self):
        async def _test():
            client = FCMClient(enabled=False)

            res1 = await client.send_push(
                device_token="fcm_valid_device_token_string_123456",
                title="Gate Scan Update",
                body="500 pengunjung telah check-in di Gate A",
            )
            assert res1.ok is True
            assert res1.data.get("simulated") is True

            # Short / invalid token rejection
            res_err = await client.send_push(
                device_token="short",
                title="Test",
                body="Body",
            )
            assert res_err.ok is False
            assert res_err.error_code == "INVALID_DEVICE_TOKEN"

        asyncio.run(_test())
