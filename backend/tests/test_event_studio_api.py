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


def test_brief_numeric_validation_rejects_invalid_values():
    token = get_organizer_token()
    headers = {"Authorization": f"Bearer {token}"}
    event_id = "evt-aruna-2026"

    base_brief = {
        "name": "Festival Aruna Musik Makassar 2026",
        "event_type": "Konser",
        "objective": "Validation Test",
        "city": "Makassar",
        "venue_preference": "Indoor",
        "start_date": "2026-08-14",
        "days": 2,
        "setup_days": 1,
        "capacity": 3000,
        "budget": 950000000,
        "currency": "IDR",
    }

    # Negative capacity
    r_neg_cap = requests.put(f"{API}/events/{event_id}/brief", headers=headers, json={**base_brief, "capacity": -100})
    assert r_neg_cap.status_code == 422

    # Negative budget
    r_neg_bud = requests.put(f"{API}/events/{event_id}/brief", headers=headers, json={**base_brief, "budget": -50000000})
    assert r_neg_bud.status_code == 422

    # Zero days
    r_zero_days = requests.put(f"{API}/events/{event_id}/brief", headers=headers, json={**base_brief, "days": 0})
    assert r_zero_days.status_code == 422

    # Negative days
    r_neg_days = requests.put(f"{API}/events/{event_id}/brief", headers=headers, json={**base_brief, "days": -3})
    assert r_neg_days.status_code == 422

    # Negative setup days
    r_neg_setup = requests.put(f"{API}/events/{event_id}/brief", headers=headers, json={**base_brief, "setup_days": -1})
    assert r_neg_setup.status_code == 422

    # Valid brief passes
    r_valid = requests.put(f"{API}/events/{event_id}/brief", headers=headers, json=base_brief)
    assert r_valid.status_code == 200


def test_requirement_dependency_validation():
    token = get_organizer_token()
    headers = {"Authorization": f"Bearer {token}"}
    event_id = "evt-aruna-2026"

    # 1. Create requirement A
    r_a = requests.post(f"{API}/events/{event_id}/requirements", headers=headers, json={
        "category": "Stage",
        "title": "Dep Validation - Stage Setup",
        "description": "Main stage",
        "quantity": 1,
        "priority": "High"
    })
    assert r_a.status_code == 200
    req_a_id = r_a.json()["item"]["id"]

    try:
        # 2. Create requirement B with valid dependency on A
        r_b = requests.post(f"{API}/events/{event_id}/requirements", headers=headers, json={
            "category": "Sound",
            "title": "Dep Validation - Sound Line Array",
            "description": "FOH Sound",
            "quantity": 1,
            "priority": "High",
            "dependencies": [req_a_id, req_a_id]  # Contains duplicate to test deduplication
        })
        assert r_b.status_code == 200
        req_b = r_b.json()["item"]
        req_b_id = req_b["id"]
        assert req_b["dependencies"] == [req_a_id]

        try:
            # 3. Create requirement with non-existent dependency ID -> 400
            r_bad_dep = requests.post(f"{API}/events/{event_id}/requirements", headers=headers, json={
                "category": "Lighting",
                "title": "Dep Validation - Lighting",
                "dependencies": ["req-non-existent-99999"]
            })
            assert r_bad_dep.status_code == 400
            assert "do not exist" in r_bad_dep.json()["detail"]

            # 4. Patch with self-dependency -> 400
            r_self_dep = requests.patch(f"{API}/events/{event_id}/requirements/{req_b_id}", headers=headers, json={
                "dependencies": [req_b_id]
            })
            assert r_self_dep.status_code == 400
            assert "Self-dependency is not allowed" in r_self_dep.json()["detail"]

        finally:
            requests.delete(f"{API}/events/{event_id}/requirements/{req_b_id}", headers=headers)
    finally:
        requests.delete(f"{API}/events/{event_id}/requirements/{req_a_id}", headers=headers)
