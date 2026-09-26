from __future__ import annotations

from pathlib import Path
import re
import wave

import numpy as np

from app.audio.concatenate import concatenate_wavs
from app.config import settings
from app.services.markup import parse_markup
from app.tts.kokoro_engine import KokoroEngine


def slugify_topic(topic: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", topic.strip()).strip("-").lower()
    return slug[:80] or "conversation"


def unique_output_path(topic: str, extension: str = "wav") -> Path:
    base = slugify_topic(topic)
    ext = extension.lstrip(".")
    candidate = settings.output_dir / f"{base}.{ext}"
    if not candidate.exists():
        return candidate
    index = 2
    while True:
        candidate = settings.output_dir / f"{base}-{index}.{ext}"
        if not candidate.exists():
            return candidate
        index += 1


def write_silence(seconds: float, destination: Path, sample_rate: int = 24000) -> Path:
    frames = max(1, int(sample_rate * seconds))
    with wave.open(str(destination), "wb") as wav:
        wav.setparams((1, 2, sample_rate, 0, "NONE", "not compressed"))
        wav.writeframes(np.zeros(frames, dtype=np.int16).tobytes())
    return destination


def synthesize_turn(engine: KokoroEngine, text: str, voice_id: str, speed: float) -> Path:
    """Synthesize one turn, expanding [pause]/[laugh]/etc. tags."""
    parts = parse_markup(text)
    if len(parts) == 1 and parts[0].kind == "speech":
        return engine.synthesize(parts[0].value, voice_id, speed)

    segments: list[tuple[Path, float]] = []
    for index, part in enumerate(parts):
        if part.kind == "pause":
            silence = settings.temp_dir / f"silence-{part.seconds:.2f}.wav"
            if not silence.exists():
                write_silence(part.seconds, silence, engine.sample_rate)
            segments.append((silence, 0.0))
            continue
        spoken = part.value if part.kind == "speech" else part.value
        audio = engine.synthesize(spoken, voice_id, speed)
        trailing = 0.12 if index < len(parts) - 1 else 0.0
        segments.append((audio, trailing))

    combined = settings.temp_dir / f"turn-{engine.cache_key(text, voice_id, speed)}.wav"
    if not combined.exists():
        concatenate_wavs(segments, combined)
    return combined
