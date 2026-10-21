from __future__ import annotations

from threading import Thread

from fastapi import APIRouter, HTTPException

from app.api.deps import fail
from app.models.schemas import PrefsUpdate
from app.services.prefs import load_prefs, save_prefs
from app.tts.factory import engine_hub
from app.tts.model_manager import model_manager

router = APIRouter(tags=["models"])


@router.get("/api/models")
def list_models() -> list[dict]:
    return model_manager.list_models()


@router.get("/api/prefs")
def get_prefs() -> dict:
    return load_prefs()


@router.put("/api/prefs")
def put_prefs(payload: PrefsUpdate) -> dict:
    try:
        patch = payload.model_dump(exclude_none=True)
        return save_prefs(patch)
    except ValueError as error:
        raise fail(error)


# Static paths must be declared before `/api/models/{model_id}/…` routes.
@router.post("/api/models/voices/download")
def download_voices() -> dict:
    job = model_manager.start_download_voices()
    Thread(target=model_manager.run_download_voices, args=(job.id,), daemon=True).start()
    return job.to_dict()


@router.get("/api/models/downloads/{job_id}")
def download_status(job_id: str) -> dict:
    job = model_manager.get_download(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download job not found.")
    return job.to_dict()


@router.post("/api/models/downloads/{job_id}/cancel")
def cancel_download(job_id: str) -> dict:
    job = model_manager.cancel_download(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download job not found.")
    return job.to_dict()


@router.post("/api/models/unload")
def unload_model() -> dict:
    engine_hub.unload()
    return {"status": "unloaded"}


@router.post("/api/models/{model_id}/select")
def select_model(model_id: str) -> dict:
    try:
        return model_manager.select_model(model_id)
    except ValueError as error:
        raise fail(error)


@router.post("/api/models/{model_id}/download")
def download_model(model_id: str) -> dict:
    try:
        job = model_manager.start_download_model(model_id)
    except ValueError as error:
        raise fail(error)
    Thread(target=model_manager.run_download_model, args=(job.id, model_id), daemon=True).start()
    return job.to_dict()


@router.post("/api/models/{model_id}/load")
def load_model(model_id: str) -> dict:
    try:
        model_manager.select_model(model_id)
        engine_hub.get(model_id)
        return {"status": "loaded", "model_id": model_id, **engine_hub.status()}
    except Exception as error:  # noqa: BLE001
        raise fail(error)


@router.delete("/api/models/{model_id}")
def delete_model(model_id: str) -> dict:
    try:
        if engine_hub.status().get("model_id") == model_id:
            engine_hub.unload()
        return model_manager.delete_model(model_id)
    except ValueError as error:
        raise fail(error)
