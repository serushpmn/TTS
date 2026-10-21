from __future__ import annotations

import json
from threading import Lock

from app.config import settings
from app.services.atomic import atomic_write_json
from app.services.tone import get_tone
from app.tts.languages import get_language
from app.tts.registry import DEFAULT_MODEL_ID, get_variant
from app.tts.voices import find_voice


PREFS_FILE = settings.data_dir / "prefs.json"
_lock = Lock()


def _defaults() -> dict:
    return {
        "selected_model_id": DEFAULT_MODEL_ID,
        "playback_rate": 1.0,
        "favorite_voices": [],
        "default_voice_id": "af_heart",
        "trim_silence_default": False,
        "strict_cast": True,
        "ui_locale": "en",
        "synth_lang": "auto",
        "default_tone_id": "neutral",
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
    favorites = merged.get("favorite_voices") or []
    if not isinstance(favorites, list):
        favorites = []
    merged["favorite_voices"] = [str(item) for item in favorites]
    default_voice = str(merged.get("default_voice_id") or "af_heart")
    try:
        find_voice(default_voice)
    except ValueError:
        default_voice = "af_heart"
    merged["default_voice_id"] = default_voice
    merged["trim_silence_default"] = bool(merged.get("trim_silence_default", False))
    merged["strict_cast"] = bool(merged.get("strict_cast", True))
    locale = str(merged.get("ui_locale") or "en").lower()
    if locale not in ("en", "fa", "de"):
        locale = "en"
    merged["ui_locale"] = locale
    try:
        get_language(str(merged.get("synth_lang") or "en-us"))
    except ValueError:
        merged["synth_lang"] = "en-us"
    try:
        get_tone(str(merged.get("default_tone_id") or "neutral"))
    except ValueError:
        merged["default_tone_id"] = "neutral"
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
        if "favorite_voices" in patch:
            favorites = patch["favorite_voices"] or []
            if not isinstance(favorites, list):
                raise ValueError("favorite_voices must be a list.")
            cleaned: list[str] = []
            for item in favorites:
                voice_id = str(item)
                find_voice(voice_id)
                if voice_id not in cleaned:
                    cleaned.append(voice_id)
            current["favorite_voices"] = cleaned
        if "default_voice_id" in patch and patch["default_voice_id"] is not None:
            voice_id = str(patch["default_voice_id"])
            find_voice(voice_id)
            current["default_voice_id"] = voice_id
        if "trim_silence_default" in patch and patch["trim_silence_default"] is not None:
            current["trim_silence_default"] = bool(patch["trim_silence_default"])
        if "strict_cast" in patch and patch["strict_cast"] is not None:
            current["strict_cast"] = bool(patch["strict_cast"])
        if "ui_locale" in patch and patch["ui_locale"] is not None:
            locale = str(patch["ui_locale"]).lower()
            if locale not in ("en", "fa", "de"):
                raise ValueError("ui_locale must be en, fa, or de.")
            current["ui_locale"] = locale
        if "synth_lang" in patch and patch["synth_lang"] is not None:
            get_language(str(patch["synth_lang"]))
            current["synth_lang"] = str(patch["synth_lang"])
        if "default_tone_id" in patch and patch["default_tone_id"] is not None:
            get_tone(str(patch["default_tone_id"]))
            current["default_tone_id"] = str(patch["default_tone_id"])
        for key, value in patch.items():
            if key in (
                "selected_model_id",
                "playback_rate",
                "favorite_voices",
                "default_voice_id",
                "trim_silence_default",
                "strict_cast",
                "ui_locale",
                "synth_lang",
                "default_tone_id",
            ):
                continue
            current[key] = value
        atomic_write_json(PREFS_FILE, current)
        return current


def selected_model_id() -> str:
    return str(load_prefs().get("selected_model_id") or DEFAULT_MODEL_ID)
