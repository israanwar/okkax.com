"""Focused contract tests for the shared calendar engine (no database writes)."""

from datetime import date
from pathlib import Path

import pytest
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from calendar_engine import (PUBLIC_STATUS_LABELS, _date, _event_lifecycle,
                             _normalise_custom, calendar, detect_conflicts)


def test_public_calendar_exposes_every_required_status():
    assert set(PUBLIC_STATUS_LABELS) == {
        "upcoming", "ongoing", "completed", "rescheduled", "postponed", "cancelled",
        "tickets_on_sale", "tenant_open", "sponsor_open", "workforce_open",
    }


def test_local_iso_date_does_not_shift_to_previous_utc_day():
    assert _date("2026-08-14T00:00:00+07:00") == date(2026, 8, 14)


def test_lifecycle_respects_calendar_override_without_unpublishing_event():
    event = {"start_date": "2026-09-10", "end_date": "2026-09-10", "calendar_status": "postponed"}
    assert _event_lifecycle(event, date(2026, 8, 14)) == "postponed"


def test_conflict_engine_reports_overlap_overtime_dependency_and_travel():
    entries = [
        {"id": "venue-a", "event_id": "event-a", "title": "Venue A", "resource_type": "venue",
         "resource_id": "venue-1", "resource_name": "Venue Demo",
         "start_at": "2099-01-01T10:00:00+07:00", "end_at": "2099-01-01T12:00:00+07:00"},
        {"id": "venue-b", "event_id": "event-b", "title": "Venue B", "resource_type": "venue",
         "resource_id": "venue-1", "resource_name": "Venue Demo",
         "start_at": "2099-01-01T11:00:00+07:00", "end_at": "2099-01-01T13:00:00+07:00"},
        {"id": "worker-long", "event_id": "event-a", "title": "Shift panjang", "resource_type": "worker",
         "resource_id": "worker-1", "resource_name": "Worker Demo",
         "start_at": "2099-01-02T06:00:00+07:00", "end_at": "2099-01-02T20:30:00+07:00",
         "dependency_ids": ["approval-missing"]},
        {"id": "talent-a", "event_id": "event-a", "title": "Performance Jakarta", "resource_type": "talent",
         "resource_id": "talent-1", "resource_name": "Talent Demo", "city": "Jakarta",
         "start_at": "2099-01-03T18:00:00+07:00", "end_at": "2099-01-03T22:00:00+07:00"},
        {"id": "talent-b", "event_id": "event-b", "title": "Performance Makassar", "resource_type": "talent",
         "resource_id": "talent-1", "resource_name": "Talent Demo", "city": "Makassar",
         "start_at": "2099-01-04T04:00:00+07:00", "end_at": "2099-01-04T06:00:00+07:00"},
    ]
    kinds = {conflict["kind"] for conflict in detect_conflicts(entries)}
    assert {"overlap", "overtime", "dependency", "travel_buffer"}.issubset(kinds)


def _body(**overrides):
    base = {"title": "Rehearsal tambahan", "start_at": "2099-05-01T10:00:00+07:00",
            "end_at": "2099-05-01T12:00:00+07:00", "resource_type": "talent",
            "resource_id": "talent-42"}
    base.update(overrides)
    return base


def test_normalise_custom_rejects_missing_required_fields():
    with pytest.raises(HTTPException) as info:
        _normalise_custom(_body(title=""), {"id": "user-1"})
    assert info.value.status_code == 400
    assert "title" in info.value.detail


def test_normalise_custom_rejects_inverted_time_range():
    with pytest.raises(HTTPException) as info:
        _normalise_custom(_body(end_at="2099-05-01T09:00:00+07:00"), {"id": "user-1"})
    assert info.value.status_code == 400
    assert "setelah" in info.value.detail


def test_normalise_custom_strips_disallowed_keys_and_stamps_owner():
    doc = _normalise_custom(_body(id="ignored", secret="nope"), {"id": "user-77"})
    assert "id" not in doc and "secret" not in doc
    assert doc["created_by"] == "user-77" and doc["owner_user_id"] == "user-77"
    assert doc["entry_type"] == "custom" and doc["source_type"] == "calendar_entry"


def test_delete_route_is_registered_on_calendar_router():
    routes = {(route.path, tuple(sorted(route.methods))) for route in calendar.routes}
    assert ("/api/calendar/entries/{entry_id}", ("DELETE",)) in routes
