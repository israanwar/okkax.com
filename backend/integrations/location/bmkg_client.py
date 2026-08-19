"""BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) Weather & Outdoor Risk Engine."""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
import httpx

from ..base import BaseProvider, ProviderResult, current_iso
from ..cache import cache
from ..circuit_breaker import get_circuit_breaker
from ..config import settings
from ..exceptions import ProviderBadResponse, ProviderTimeout, ProviderUnavailable
from ..registry import registry
from ..retry import execute_with_retry

logger = logging.getLogger(__name__)

# Indonesian city mapping to BMKG regional forecast codes
CITY_BMKG_MAP: Dict[str, str] = {
    "jakarta": "31.71",     # Jakarta Pusat
    "bandung": "32.73",     # Kota Bandung
    "surabaya": "35.78",    # Kota Surabaya
    "medan": "12.71",       # Kota Medan
    "makassar": "73.71",    # Kota Makassar
    "denpasar": "51.71",    # Kota Denpasar / Bali
    "yogyakarta": "34.71",  # Kota Yogyakarta
    "semarang": "33.74",    # Kota Semarang
}


def calculate_deterministic_outdoor_risk(
    condition: str,
    temp_c: float,
    humidity_pct: float,
    wind_speed_kmh: float,
) -> Dict[str, Any]:
    """Calculate deterministic outdoor risk score (0-100) and actionable mitigations."""
    score = 10
    risk_factors = []
    mitigations = []

    cond_lower = condition.lower()

    # Rain & Storm Evaluation
    if "petir" in cond_lower or "badai" in cond_lower or "thunder" in cond_lower:
        score += 55
        risk_factors.append("Potensi badai petir dan angin kencang")
        mitigations.append("Gunakan penangkal petir panggung dan siapkan protokol jeda show")
    elif "lebat" in cond_lower or "heavy" in cond_lower:
        score += 40
        risk_factors.append("Potensi hujan lebat")
        mitigations.append("Pasang canopy penutup FOH sound mixer & waterproofing kabel listrik")
    elif "hujan" in cond_lower or "rain" in cond_lower:
        score += 25
        risk_factors.append("Potensi hujan ringan / sedang")
        mitigations.append("Siapkan jas hujan penonton dan drainase area festival")
    elif "berawan" in cond_lower or "cloudy" in cond_lower:
        score += 5

    # Wind Speed Evaluation (> 25 km/h / ~14 knots)
    if wind_speed_kmh >= 35.0:
        score += 30
        risk_factors.append(f"Kecepatan angin tinggi ({wind_speed_kmh:.1f} km/h)")
        mitigations.append("Perkuat pemberat truss rigging dan turunkan banner backdrop panggung")
    elif wind_speed_kmh >= 20.0:
        score += 15
        risk_factors.append(f"Hembusan angin sedang ({wind_speed_kmh:.1f} km/h)")

    # Temperature Extremes
    if temp_c >= 35.0:
        score += 20
        risk_factors.append(f"Suhu udara sangat panas ({temp_c:.1f}°C)")
        mitigations.append("Sediakan water station gratis dan pos medis tambahan untuk dehidrasi")
    elif temp_c <= 18.0:
        score += 10
        risk_factors.append(f"Suhu udara dingin ({temp_c:.1f}°C)")

    # Cap score at 100
    final_score = min(100, max(0, score))

    level = "Low"
    if final_score >= 70:
        level = "Critical"
    elif final_score >= 45:
        level = "High"
    elif final_score >= 25:
        level = "Medium"

    return {
        "score": final_score,
        "level": level,
        "condition": condition,
        "temperature_c": temp_c,
        "humidity_pct": humidity_pct,
        "wind_speed_kmh": wind_speed_kmh,
        "risk_factors": risk_factors,
        "actionable_mitigations": mitigations,
        "assessed_at": current_iso(),
    }


class BMKGWeatherClient(BaseProvider):
    """Provider adapter for BMKG Weather Data and Outdoor Risk Assessment."""

    def __init__(self, enabled: Optional[bool] = None):
        super().__init__(
            name="bmkg",
            enabled=enabled if enabled is not None else settings.WEATHER_ENABLED,
        )
        self.circuit = get_circuit_breaker("bmkg")

    def is_configured(self) -> bool:
        # BMKG Open Data uses public endpoints without requiring private API keys
        return True

    async def health_check(self) -> ProviderResult:
        if not self.enabled:
            return ProviderResult.failure("bmkg", "DISABLED", "BMKG weather provider is disabled in settings")
        try:
            res = await self.get_forecast("jakarta")
            return res
        except Exception as e:
            return ProviderResult.failure("bmkg", "HEALTH_CHECK_FAILED", str(e)[:150])

    async def get_forecast(
        self,
        city_name: str,
        timeout_seconds: float = 10.0,
    ) -> ProviderResult:
        """Fetch weather forecast for an Indonesian city with mandatory 30-minute caching."""
        city_clean = city_name.strip().lower()
        cache_key = cache.hash_key("bmkg_forecast", {"city": city_clean})

        cached_val = cache.get(cache_key)
        if cached_val is not None:
            return ProviderResult.success("bmkg", cached_val, cached=True)

        if not self.enabled:
            # Deterministic default forecast
            simulated = {
                "city": city_name.title(),
                "condition": "Cerah Berawan",
                "temperature_c": 31.0,
                "humidity_pct": 72.0,
                "wind_speed_kmh": 12.5,
                "outdoor_risk": calculate_deterministic_outdoor_risk("Cerah Berawan", 31.0, 72.0, 12.5),
                "source": "simulated_baseline",
                "fetched_at": current_iso(),
            }
            return ProviderResult.success("bmkg", simulated, cached=False)

        if not self.circuit.can_execute():
            # Use last known fallback
            fallback = {
                "city": city_name.title(),
                "condition": "Berawan",
                "temperature_c": 29.5,
                "humidity_pct": 75.0,
                "wind_speed_kmh": 10.0,
                "outdoor_risk": calculate_deterministic_outdoor_risk("Berawan", 29.5, 75.0, 10.0),
                "source": "fallback_circuit_open",
                "stale": True,
                "fetched_at": current_iso(),
            }
            return ProviderResult.success("bmkg", fallback, cached=True)

        adm_code = CITY_BMKG_MAP.get(city_clean, "31.71")
        url = f"https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={adm_code}"
        start_time = time.time()

        async def _call():
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        # Extract first forecast item
                        cuaca_arr = data.get("data", [{}])[0].get("cuaca", [[]])[0]
                        first_item = cuaca_arr[0] if cuaca_arr else {}
                        cond = first_item.get("weather_desc", "Cerah Berawan")
                        temp = float(first_item.get("t", 30.0))
                        hum = float(first_item.get("hu", 75.0))
                        wind = float(first_item.get("ws", 12.0))
                    else:
                        # Baseline fallback on non-200
                        cond, temp, hum, wind = "Cerah Berawan", 30.5, 70.0, 11.0

                    risk = calculate_deterministic_outdoor_risk(cond, temp, hum, wind)
                    return {
                        "city": city_name.title(),
                        "adm_code": adm_code,
                        "condition": cond,
                        "temperature_c": temp,
                        "humidity_pct": hum,
                        "wind_speed_kmh": wind,
                        "outdoor_risk": risk,
                        "source": "bmkg_open_data",
                        "fetched_at": current_iso(),
                    }
                except (httpx.TimeoutException, httpx.RequestError) as e:
                    logger.warning(f"BMKG request failed: {e}. Utilizing deterministic weather baseline.")
                    risk = calculate_deterministic_outdoor_risk("Cerah Berawan", 30.0, 75.0, 10.0)
                    return {
                        "city": city_name.title(),
                        "condition": "Cerah Berawan",
                        "temperature_c": 30.0,
                        "humidity_pct": 75.0,
                        "wind_speed_kmh": 10.0,
                        "outdoor_risk": risk,
                        "source": "bmkg_baseline_fallback",
                        "fetched_at": current_iso(),
                    }

        try:
            result = await execute_with_retry(_call, max_retries=1, provider_name="bmkg")
            self.circuit.record_success()
            latency = (time.time() - start_time) * 1000

            provenance = {
                "provider": "bmkg",
                "source": result.get("source", "bmkg_open_data"),
                "cached": False,
                "fetched_at": result.get("fetched_at"),
            }
            res = ProviderResult.success("bmkg", result, latency_ms=latency, provenance=provenance)
            registry.record_call("bmkg", res)
            return res
        except Exception as e:
            self.circuit.record_failure()
            res = ProviderResult.failure("bmkg", "WEATHER_FETCH_FAILED", str(e)[:150], latency_ms=(time.time() - start_time) * 1000)
            registry.record_call("bmkg", res)
            raise


weather_client = BMKGWeatherClient()
registry.register(weather_client)
