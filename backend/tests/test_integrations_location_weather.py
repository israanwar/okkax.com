"""Unit tests for Location, Routes, and BMKG Weather with Outdoor Risk Engine."""

import asyncio
from pathlib import Path
import sys
import pytest

# Ensure backend root is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from integrations.location.bmkg_client import BMKGWeatherClient, calculate_deterministic_outdoor_risk
from integrations.location.google_places_client import GooglePlacesClient
from integrations.location.google_routes_client import GoogleRoutesClient


class TestGooglePlacesAdapter:
    def test_places_search_simulation_and_schema(self):
        async def _test():
            client = GooglePlacesClient(enabled=False)

            res = await client.search_places("GBK Senayan", limit=3)
            assert res.ok is True
            assert isinstance(res.data, list)
            assert len(res.data) > 0
            place = res.data[0]
            assert "place_id" in place
            assert "name" in place
            assert "formatted_address" in place
            assert "latitude" in place
            assert "longitude" in place

            # Empty query validation
            res_err = await client.search_places("")
            assert res_err.ok is False
            assert res_err.error_code == "INVALID_QUERY"

        asyncio.run(_test())


class TestGoogleRoutesAdapter:
    def test_routes_computation_and_simulation(self):
        async def _test():
            client = GoogleRoutesClient(enabled=False)

            orig = {"latitude": -6.2088, "longitude": 106.8456}
            dest = {"latitude": -6.2188, "longitude": 106.8026}

            res = await client.compute_route(origin=orig, destination=dest)
            assert res.ok is True
            data = res.data
            assert data["distance_meters"] > 0
            assert data["duration_seconds"] > 0
            assert data["travel_mode"] == "DRIVE"

            # Invalid coordinates rejection
            res_err = await client.compute_route(origin={}, destination=dest)
            assert res_err.ok is False
            assert res_err.error_code == "INVALID_COORDINATES"

        asyncio.run(_test())


class TestBMKGWeatherAndOutdoorRisk:
    def test_outdoor_risk_deterministic_matrix(self):
        # 1. Severe thunderstorm scenario
        storm = calculate_deterministic_outdoor_risk(
            condition="Hujan Petir dan Angin Kencang",
            temp_c=28.0,
            humidity_pct=88.0,
            wind_speed_kmh=38.0,
        )
        assert storm["level"] in ("Critical", "High")
        assert storm["score"] >= 70
        assert any("penangkal petir" in m for m in storm["actionable_mitigations"])
        assert any("truss rigging" in m for m in storm["actionable_mitigations"])

        # 2. Extreme heat scenario
        heat = calculate_deterministic_outdoor_risk(
            condition="Cerah",
            temp_c=36.5,
            humidity_pct=55.0,
            wind_speed_kmh=10.0,
        )
        assert any("water station" in m for m in heat["actionable_mitigations"])

        # 3. Clear sunny baseline scenario
        clear = calculate_deterministic_outdoor_risk(
            condition="Cerah Berawan",
            temp_c=29.0,
            humidity_pct=65.0,
            wind_speed_kmh=12.0,
        )
        assert clear["level"] == "Low"
        assert clear["score"] <= 25

    def test_bmkg_forecast_fetch(self):
        async def _test():
            client = BMKGWeatherClient(enabled=False)

            res = await client.get_forecast("jakarta")
            assert res.ok is True
            data = res.data
            assert data["city"] == "Jakarta"
            assert "outdoor_risk" in data
            assert "score" in data["outdoor_risk"]
            assert "actionable_mitigations" in data["outdoor_risk"]

        asyncio.run(_test())
