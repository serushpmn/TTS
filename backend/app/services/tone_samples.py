from __future__ import annotations

from pathlib import Path

from app.config import settings
from app.services.synthesis import synthesize_turn
from app.services.tone import TONE_STYLES, get_tone
from app.tts.factory import engine_hub
from app.tts.voices import find_voice


SAMPLE_TEXT = "This is how I sound with this delivery style."
SAMPLES_DIR = settings.data_dir / "tone_samples"


def samples_dir() -> Path:
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    return SAMPLES_DIR


def sample_path(tone_id: str) -> Path:
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in tone_id)
    return samples_dir() / f"{safe}.wav"


def sample_url(tone_id: str) -> str | None:
    path = sample_path(tone_id)
    if path.is_file() and path.stat().st_size > 1000:
        return f"/tone-samples/{path.name}"
    return None


def list_tone_sample_status() -> list[dict]:
    return [
        {
            "tone_id": style.id,
            "ready": sample_url(style.id) is not None,
            "url": sample_url(style.id),
        }
        for style in TONE_STYLES
    ]


def ensure_tone_sample(
    tone_id: str,
    *,
    voice_id: str = "af_heart",
    model_id: str | None = None,
    force: bool = False,
) -> Path:
    """Generate and store a short tone preview WAV if missing."""
    get_tone(tone_id)
    path = sample_path(tone_id)
    if path.exists() and path.stat().st_size > 1000 and not force:
        return path

    find_voice(voice_id)
    engine = engine_hub.get(model_id) if model_id else engine_hub.get()
    generated = synthesize_turn(
        SAMPLE_TEXT,
        voice_id,
        1.0,
        engine=engine,
        model_id=getattr(engine, "model_id", None),
        apply_dict=False,
        tone_id=tone_id,
        synth_lang="en-us",
    )
    path.write_bytes(Path(generated).read_bytes())
    return path
