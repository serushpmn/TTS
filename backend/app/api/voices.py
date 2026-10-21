from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter

from app.api.deps import fail
from app.config import settings
from app.models.schemas import PronunciationDict, PronunciationEntry, Voice
from app.services import pronunciation as pronunciation_service
from app.services.prefs import load_prefs
from app.services.voice_samples import ensure_sample, list_sample_status, sample_url
from app.tts.factory import engine_hub
from app.tts.model_manager import model_manager
from app.tts.voices import list_voices

router = APIRouter(tags=["voices"])
_sample_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="voice-sample")


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
    return list_voices()


@router.get("/api/voices/samples")
def voice_samples() -> list[dict]:
    return list_sample_status()


@router.post("/api/voices/{voice_id}/sample")
def build_voice_sample(voice_id: str, force: bool = False) -> dict:
    prefs = load_prefs()
    model_id = prefs.get("selected_model_id")

    def work() -> str:
        path = ensure_sample(voice_id, model_id=model_id, force=force)
        return path.name

    try:
        name = _sample_pool.submit(work).result()
        return {"voice_id": voice_id, "url": f"/voice-samples/{name}", "ready": True}
    except Exception as error:  # noqa: BLE001
        raise fail(error)


@router.post("/api/voices/samples/ensure-all")
def ensure_all_samples(force: bool = False) -> dict:
    """Generate any missing pre-baked samples (runs sequentially in a worker)."""
    prefs = load_prefs()
    model_id = prefs.get("selected_model_id")

    def work() -> list[dict]:
        results = []
        for voice in list_voices():
            try:
                ensure_sample(voice.id, model_id=model_id, force=force)
                results.append({"voice_id": voice.id, "ready": True, "url": sample_url(voice.id)})
            except Exception as error:  # noqa: BLE001
                results.append({"voice_id": voice.id, "ready": False, "error": str(error)})
        return results

    try:
        results = _sample_pool.submit(work).result()
        return {"count": len(results), "results": results}
    except Exception as error:  # noqa: BLE001
        raise fail(error)


@router.get("/api/status/offline")
def offline_status() -> dict:
    return model_manager.offline_status()


@router.get("/api/pronunciation")
def get_pronunciation() -> dict[str, str]:
    return pronunciation_service.list_entries()


@router.put("/api/pronunciation")
def put_pronunciation(payload: PronunciationDict) -> dict[str, str]:
    return pronunciation_service.save_entries(payload.entries)


@router.post("/api/pronunciation")
def post_pronunciation(entry: PronunciationEntry) -> dict[str, str]:
    try:
        return pronunciation_service.upsert_entry(entry.word, entry.pronunciation)
    except ValueError as error:
        raise fail(error)


@router.delete("/api/pronunciation/{word}")
def remove_pronunciation(word: str) -> dict[str, str]:
    return pronunciation_service.delete_entry(word)
