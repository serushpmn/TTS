from __future__ import annotations

from pathlib import Path

from app.config import settings


SAMPLE_TEXT = "Hello, this is a short sample of my voice."
SAMPLES_DIR = settings.data_dir / "voice_samples"


def samples_dir() -> Path:
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    return SAMPLES_DIR


def sample_path(voice_id: str) -> Path:
    return samples_dir() / f"{voice_id}.wav"


def sample_url(voice_id: str) -> str | None:
    path = sample_path(voice_id)
    if path.is_file() and path.stat().st_size > 1000:
        return f"/voice-samples/{path.name}"
    return None


def list_sample_status() -> list[dict]:
    from app.tts.voices import list_voices

    return [
        {
            "voice_id": voice.id,
            "ready": sample_url(voice.id) is not None,
            "url": sample_url(voice.id),
        }
        for voice in list_voices()
    ]


def ensure_sample(voice_id: str, *, model_id: str | None = None, force: bool = False) -> Path:
    """Generate and store a sample WAV if missing (or if force=True)."""
    from app.services.synthesis import synthesize_turn
    from app.tts.factory import engine_hub
    from app.tts.voices import find_voice

    find_voice(voice_id)
    path = sample_path(voice_id)
    if path.exists() and path.stat().st_size > 1000 and not force:
        return path
    engine = engine_hub.get(model_id) if model_id else engine_hub.get()
    generated = synthesize_turn(
        SAMPLE_TEXT,
        voice_id,
        1.0,
        engine=engine,
        model_id=getattr(engine, "model_id", None),
        apply_dict=False,
    )
    path.write_bytes(Path(generated).read_bytes())
    return path
