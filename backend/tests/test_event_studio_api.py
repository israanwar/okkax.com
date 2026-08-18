import os
import pytest
import requests

API = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001") + "/api"

PW = os.environ.get("DEMO_PASSWORD", "DPOqsn1PJS1ATka0oagr8LCi")

def get_organizer_token():
    r = requests.post(f"{API}/auth/login", json={"email": "organizer@okkax.id", "password": PW})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["token"]

def test_event_studio_lifecycle_and_requirements():
    token = get_organizer_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. List events to find an active event or create one
    events_res = requests.get(f"{API}/events", headers=headers)
    assert events_res.status_code == 200
    events = events_res.json().get("items", [])
    
    if events:
        event_id = events[0]["id"]
    else:
        brief_payload = {
            "name": "TEST Studio Music Fest 2026",
            "event_type": "Konser",
            "objective": "Uji integrasi Studio",
            "description": "Event uji coba Event Studio",
            "city": "Makassar",
            "venue_preference": "Indoor",
            "start_date": "2026-10-15",
            "days": 1,
            "setup_days": 1,
            "capacity": 2000,
            "budget": 750000000,
            "currency": "IDR",
            "target_age": "18-35",
            "audience_profile": "Music lovers",
            "attendance_format": "Offline"
        }
        create_res = requests.post(f"{API}/events", json=brief_payload, headers=headers)
        assert create_res.status_code in (200, 201)
        event_id = create_res.json()["event"]["id"]

    # 2. Get and update brief
    brief_res = requests.get(f"{API}/events/{event_id}/brief", headers=headers)
    assert brief_res.status_code == 200
    
    update_payload = {
        "name": "OKKAX Studio Verified Festival",
        "event_type": "Festival",
        "objective": "Orchestrating Event, Network, Calendar",
        "description": "Event Studio end-to-end integration test",
        "city": "Makassar",
        "venue_preference": "Indoor",
        "start_date": "2026-10-20",
        "days": 2,
        "setup_days": 2,
        "capacity": 3000,
        "budget": 900000000,
        "currency": "IDR",
        "target_age": "18-35",
        "audience_profile": "Live event audience",
        "attendance_format": "Offline"
    }
    put_res = requests.put(f"{API}/events/{event_id}/brief", json=update_payload, headers=headers)
    assert put_res.status_code == 200
    assert put_res.json()["event"]["name"] == "OKKAX Studio Verified Festival"

    # 3. Test Requirements Auto-generation
    auto_res = requests.post(f"{API}/events/{event_id}/requirements/auto-generate", headers=headers)
    assert auto_res.status_code == 200
    reqs = auto_res.json()["items"]
    assert len(reqs) >= 10
    
    # 4. List Requirements
    list_res = requests.get(f"{API}/events/{event_id}/requirements", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 10

    # 5. Create a Custom Requirement
    new_req = {
        "category": "Logistik",
        "title": "Genset Backup 250kVA",
        "description": "Daya cadangan darurat untuk FOH dan audio amplifier",
        "quantity": 2,
        "priority": "High",
        "budget_estimate": 15000000,
        "deadline": "2026-10-18",
        "status": "Open"
    }
    create_req_res = requests.post(f"{API}/events/{event_id}/requirements", json=new_req, headers=headers)
    assert create_req_res.status_code == 200
    created_id = create_req_res.json()["item"]["id"]

    # 6. Patch Requirement
    patch_req_res = requests.patch(
        f"{API}/events/{event_id}/requirements/{created_id}",
        json={"status": "In Progress", "assigned_resource_name": "PT Daya Nusantara"},
        headers=headers
    )
    assert patch_req_res.status_code == 200
    assert patch_req_res.json()["item"]["status"] == "In Progress"
    assert patch_req_res.json()["item"]["assigned_resource_name"] == "PT Daya Nusantara"

    # 7. Delete Requirement
    del_res = requests.delete(f"{API}/events/{event_id}/requirements/{created_id}", headers=headers)
    assert del_res.status_code == 200

    # 8. Test AI Studio Actions
    audit_res = requests.post(
        f"{API}/events/{event_id}/studio/ai-action",
        json={"action": "audit_conflicts"},
        headers=headers
    )
    assert audit_res.status_code == 200
    assert "conflicts" in audit_res.json()

    next_actions_res = requests.post(
        f"{API}/events/{event_id}/studio/ai-action",
        json={"action": "next_actions"},
        headers=headers
    )
    assert next_actions_res.status_code == 200
    assert len(next_actions_res.json()["actions"]) > 0
