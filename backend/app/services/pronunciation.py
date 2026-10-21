from __future__ import annotations

import json
import re
from threading import Lock

from app.config import settings
from app.services.atomic import atomic_write_json


DICT_FILE = settings.data_dir / "pronunciation.json"
_lock = Lock()

# Default starter entries (spelling hints Kokoro can voice more clearly).
_DEFAULTS: dict[str, str] = {
    "API": "A P I",
    "TTS": "T T S",
    "UI": "U I",
    "GPU": "G P U",
    "CPU": "C P U",
    "JSON": "Jason",
    "WAV": "wave",
    "MP3": "M P three",
}


def _read_unlocked() -> dict[str, str]:
    if not DICT_FILE.exists():
        return dict(_DEFAULTS)
    try:
        data = json.loads(DICT_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return dict(_DEFAULTS)
    if not isinstance(data, dict):
        return dict(_DEFAULTS)
    cleaned = {str(k): str(v) for k, v in data.items() if str(k).strip() and str(v).strip()}
    return cleaned or dict(_DEFAULTS)


def list_entries() -> dict[str, str]:
    with _lock:
        return _read_unlocked()


def save_entries(entries: dict[str, str]) -> dict[str, str]:
    cleaned = {
        str(key).strip(): str(value).strip()
        for key, value in entries.items()
        if str(key).strip() and str(value).strip()
    }
    with _lock:
        atomic_write_json(DICT_FILE, cleaned)
        return cleaned


def upsert_entry(word: str, pronunciation: str) -> dict[str, str]:
    word = word.strip()
    pronunciation = pronunciation.strip()
    if not word or not pronunciation:
        raise ValueError("Word and pronunciation are required.")
    with _lock:
        data = _read_unlocked()
        data[word] = pronunciation
        atomic_write_json(DICT_FILE, data)
        return data


def delete_entry(word: str) -> dict[str, str]:
    with _lock:
        data = _read_unlocked()
        data.pop(word, None)
        atomic_write_json(DICT_FILE, data)
        return data


def apply_pronunciation(text: str, entries: dict[str, str] | None = None) -> str:
    """Replace whole-word dictionary keys with pronunciation hints (case-insensitive keys)."""
    mapping = entries if entries is not None else list_entries()
    if not mapping or not text:
        return text
    # Longer keys first so "API key" style compounds win when present.
    keys = sorted(mapping.keys(), key=len, reverse=True)
    result = text
    for key in keys:
        pattern = re.compile(rf"(?<!\w){re.escape(key)}(?!\w)", re.IGNORECASE)

        def repl(_match: re.Match[str], *, replacement: str = mapping[key]) -> str:
            return replacement

        result = pattern.sub(repl, result)
    return result
