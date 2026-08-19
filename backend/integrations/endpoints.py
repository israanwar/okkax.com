"""OKKAX External Integrations REST API Endpoints."""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core import db, get_current_user, is_admin, now_iso
from .health import get_all_integrations_status, run_provider_self_test
from .location.bmkg_client import weather_client
from .location.google_places_client import places_client
from .location.google_routes_client import routes_client
from .media.spotify_client import spotify_client
from .media.youtube_client import youtube_client
from .messaging.fcm_client import fcm_client
from .registry import registry
from .storage.r2_client import storage_client

logger = logging.getLogger("okkax.integrations")

router = APIRouter(prefix="/api", tags=["integrations"])


# --- Request Models ---

class DeviceTokenRegistration(BaseModel):
    token: str = Field(..., min_length=10, description="FCM / WebPush device registration token")
    platform: str = Field(default="web", description="Platform: web, android, or ios")


class PresignedUploadRequest(BaseModel):
    resource_type: str = Field(..., description="Resource category: posters, riders, invoices, quotations, contracts, evidence, avatars")
    resource_id: str = Field(..., description="Identifier of the associated event, talent, or document")
    filename: str = Field(..., description="Original filename")
    content_type: str = Field(..., description="MIME type: application/pdf, image/png, image/jpeg, image/webp")
    size_bytes: int = Field(..., gt=0, description="File size in bytes")


class PresignedDownloadRequest(BaseModel):
    object_key: str = Field(..., description="S3 / R2 object key")


class RouteComputeRequest(BaseModel):
    origin: Dict[str, float] = Field(..., description="Origin latitude and longitude")
    destination: Dict[str, float] = Field(..., description="Destination latitude and longitude")
    travel_mode: str = Field(default="DRIVE", description="Travel mode: DRIVE, WALK, BICYCLE")


# --- Endpoints ---

@router.get("/integrations/status")
async def get_integrations_status(user: dict = Depends(get_current_user)):
    """Get non-sensitive operational status of all external providers (Privileged/Ops only)."""
    # Allow admin, supervisor, promoter, organizer roles
    allowed_roles = {"admin", "supervisor", "organizer", "promoter"}
    user_roles = set(user.get("roles") or [user.get("role")])
    if not is_admin(user) and not (user_roles & allowed_roles):
        raise HTTPException(status_code=403, detail="Privileged operational role required to view integrations inventory")
    return await get_all_integrations_status()


@router.post("/integrations/{provider}/self-test")
async def run_integration_self_test(provider: str, user: dict = Depends(get_current_user)):
    """Run non-destructive diagnostic self-test for a specified provider (Admin / Supervisor only)."""
    allowed_roles = {"admin", "supervisor"}
    user_roles = set(user.get("roles") or [user.get("role")])
    if not is_admin(user) and not (user_roles & allowed_roles):
        raise HTTPException(status_code=403, detail="Admin or supervisor role required for self-test execution")
    result = await run_provider_self_test(provider)
    return {
        "provider": provider,
        "result": result.model_dump(),
    }


@router.post("/notifications/devices")
async def register_device_token(payload: DeviceTokenRegistration, user: dict = Depends(get_current_user)):
    """Register user's FCM device token for push notification awareness (Scoped to current user)."""
    doc = {
        "user_id": user["id"],
        "token": payload.token,
        "platform": payload.platform,
        "updated_at": now_iso(),
    }
    await db.device_tokens.update_one(
        {"user_id": user["id"], "token": payload.token},
        {"$set": doc},
        upsert=True,
    )
    return {"status": "registered", "token_prefix": payload.token[:10]}


@router.delete("/notifications/devices/{token}")
async def revoke_device_token(token: str, user: dict = Depends(get_current_user)):
    """Revoke user's registered device token (Scoped to current user)."""
    res = await db.device_tokens.delete_many({"user_id": user["id"], "token": token})
    return {"status": "revoked", "deleted_count": res.deleted_count}


@router.post("/storage/upload-url")
async def get_presigned_upload_url(payload: PresignedUploadRequest, user: dict = Depends(get_current_user)):
    """Generate a presigned S3/R2 upload URL with strict MIME, size, and path validation."""
    org_id = user.get("active_organization_id") or user["id"]
    res = storage_client.generate_presigned_upload_url(
        organization_id=org_id,
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        filename=payload.filename,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
    )
    if not res.ok:
        raise HTTPException(status_code=400, detail=res.error_message or "Upload URL generation failed")
    return res.data


@router.post("/storage/download-url")
async def get_presigned_download_url(payload: PresignedDownloadRequest, user: dict = Depends(get_current_user)):
    """Generate a presigned S3/R2 download URL for secure document access with workspace isolation."""
    org_id = user.get("active_organization_id") or user["id"]
    # Check that object_key belongs to user or active workspace or is public asset
    if not is_admin(user):
        clean_key = payload.object_key.lstrip("/")
        if not (clean_key.startswith(f"{org_id}/") or clean_key.startswith(f"{user['id']}/") or clean_key.startswith("public/")):
            raise HTTPException(status_code=403, detail="Access to cross-organization object key forbidden")

    res = storage_client.generate_presigned_download_url(payload.object_key)
    if not res.ok:
        raise HTTPException(status_code=400, detail=res.error_message or "Download URL generation failed")
    return res.data


@router.get("/location/places")
async def search_places_endpoint(q: str = Query(..., min_length=2), limit: int = Query(default=5, ge=1, le=20)):
    """Search venues and places with automatic caching."""
    res = await places_client.search_places(q, limit=limit)
    if not res.ok:
        raise HTTPException(status_code=502, detail=res.error_message or "Places lookup failed")
    return {"places": res.data, "cached": res.cached}


@router.post("/location/routes")
async def compute_route_endpoint(payload: RouteComputeRequest):
    """Compute travel distance and duration for event logistics."""
    res = await routes_client.compute_route(
        origin=payload.origin,
        destination=payload.destination,
        travel_mode=payload.travel_mode,
    )
    if not res.ok:
        raise HTTPException(status_code=502, detail=res.error_message or "Route calculation failed")
    return {"route": res.data, "cached": res.cached}


@router.get("/weather/forecast")
async def get_weather_forecast_endpoint(city: str = Query(default="jakarta")):
    """Get BMKG weather forecast and deterministic Outdoor Risk Assessment."""
    res = await weather_client.get_forecast(city)
    if not res.ok:
        raise HTTPException(status_code=502, detail=res.error_message or "Weather lookup failed")
    return {"forecast": res.data, "cached": res.cached}


@router.get("/media/artist")
async def get_artist_metadata_endpoint(name: str = Query(..., min_length=2)):
    """Get verified artist profile, genres, and Spotify embed data."""
    res = await spotify_client.search_artist(name)
    if not res.ok:
        raise HTTPException(status_code=502, detail=res.error_message or "Artist lookup failed")
    return {"artist": res.data, "cached": res.cached}


@router.get("/media/showreels")
async def get_showreels_endpoint(q: str = Query(..., min_length=2), limit: int = Query(default=3, ge=1, le=10)):
    """Get verified live performance showreel videos via YouTube."""
    res = await youtube_client.search_showreels(q, limit=limit)
    if not res.ok:
        raise HTTPException(status_code=502, detail=res.error_message or "Showreel lookup failed")
    return {"showreels": res.data, "cached": res.cached}
