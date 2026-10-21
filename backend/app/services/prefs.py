from __future__ import annotations

import json
from threading import Lock

from app.config import settings
from app.services.atomic import atomic_write_json
from app.tts.registry import DEFAULT_MODEL_ID, get_variant


PREFS_FILE = settings.data_dir / "prefs.json"
_lock = Lock()


def _defaults() -> dict:
    return {
        "selected_model_id": DEFAULT_MODEL_ID,
        "playback_rate": 1.0,
    }


def _read_unlocked() -> dict:
    if not PREFS_FILE.exists():
        return _defaults()
    try:
        data = json.loads(PREFS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _defaults()
    merged = _defaults()
    if isinstance(data, dict):
        merged.update(data)
    model_id = str(merged.get("selected_model_id") or DEFAULT_MODEL_ID)
    if not get_variant(model_id):
        model_id = DEFAULT_MODEL_ID
    merged["selected_model_id"] = model_id
    return merged


def load_prefs() -> dict:
    with _lock:
        return _read_unlocked()


def save_prefs(patch: dict) -> dict:
    with _lock:
        current = _read_unlocked()
        if "selected_model_id" in patch:
            model_id = str(patch["selected_model_id"])
            if not get_variant(model_id):
                raise ValueError(f"Unknown model '{model_id}'.")
            current["selected_model_id"] = model_id
        if "playback_rate" in patch:
            rate = float(patch["playback_rate"])
            current["playback_rate"] = max(0.5, min(2.0, rate))
        for key, value in patch.items():
            if key in ("selected_model_id", "playback_rate"):
                continue
            current[key] = value
        atomic_write_json(PREFS_FILE, current)
        return current


def selected_model_id() -> str:
    return str(load_prefs().get("selected_model_id") or DEFAULT_MODEL_ID)
