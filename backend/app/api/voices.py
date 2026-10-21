from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.models.schemas import Voice
from app.tts.factory import engine_hub
from app.tts.model_manager import model_manager
from app.tts.voices import VOICES

router = APIRouter(tags=["voices"])


@router.get("/api/health")
def health() -> dict:
    offline = model_manager.offline_status()
    return {
        "engine": "Kokoro",
        "device": settings.kokoro_device,
        "loaded": engine_hub.status(),
        "offline_ready": offline["offline_ready"],
        "selected_model_id": offline["selected_model_id"],
    }


@router.get("/api/voices", response_model=list[Voice])
def voices() -> list[Voice]:
    return VOICES


@router.get("/api/status/offline")
def offline_status() -> dict:
    return model_manager.offline_status()
