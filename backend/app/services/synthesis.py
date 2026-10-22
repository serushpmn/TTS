from __future__ import annotations

import hashlib
from pathlib import Path
import re
import wave

import numpy as np

from app.audio.concatenate import concatenate_wavs
from app.audio.tempfiles import create_temp_wav, unlink_quietly
from app.audio.trim import trim_wav_silence
from app.config import settings
from app.services.markup import parse_markup
from app.services.prefs import selected_model_id
from app.services.pronunciation import apply_pronunciation
from app.services.tone import apply_tone_to_text, get_tone
from app.tts.factory import engine_hub


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


def _call_synth(engine, text: str, voice_id: str, speed: float, synth_lang: str | None):
    try:
        return engine.synthesize(text, voice_id, speed, synth_lang=synth_lang)
    except TypeError:
        # Older engine signature without synth_lang.
        return engine.synthesize(text, voice_id, speed)


def synthesize_turn(
    text: str,
    voice_id: str,
    speed: float,
    engine=None,
    model_id: str | None = None,
    *,
    trim_silence: bool = False,
    apply_dict: bool = True,
    tone_id: str | None = None,
    synth_lang: str | None = None,
) -> Path:
    """Synthesize one turn, expanding tone/pause/laugh/slow tags."""
    active_engine = engine or engine_hub.get(model_id or selected_model_id())
    tone = get_tone(tone_id)
    base_speed = max(0.5, min(2.0, speed * tone.speed_rate))
    prepared = apply_tone_to_text(text, tone_id)
    if apply_dict:
        prepared = apply_pronunciation(prepared)
    parts = parse_markup(prepared)
    if len(parts) == 1 and parts[0].kind == "speech":
        path = _call_synth(active_engine, parts[0].value, voice_id, base_speed, synth_lang)
        if trim_silence:
            trimmed = settings.temp_dir / f"trim-{path.stem}.wav"
            if not trimmed.exists():
                tmp = create_temp_wav(prefix="trim-", directory=settings.temp_dir)
                try:
                    trim_wav_silence(path, tmp)
                    tmp.replace(trimmed)
                except Exception:
                    unlink_quietly(tmp)
                    raise
            return trimmed
        return path

    segments: list[tuple[Path, float]] = []
    active_speed = base_speed
    for index, part in enumerate(parts):
        if part.kind == "speed":
            active_speed = max(0.5, min(2.0, base_speed * part.rate))
            continue
        if part.kind == "pause":
            silence = settings.temp_dir / f"silence-{part.seconds:.2f}.wav"
            if not silence.exists():
                write_silence(part.seconds, silence, active_engine.sample_rate)
            segments.append((silence, 0.0))
            continue
        spoken = part.value
        audio = _call_synth(active_engine, spoken, voice_id, active_speed, synth_lang)
        trailing = 0.12 if index < len(parts) - 1 else 0.0
        segments.append((audio, trailing))

    if not segments:
        return _call_synth(active_engine, " ", voice_id, base_speed, synth_lang)

    model_key = getattr(active_engine, "model_id", model_id or "unknown")
    digest_source = f"{model_key}|{synth_lang}|{tone_id}|{prepared}|{voice_id}|{base_speed}|trim={trim_silence}"
    digest = hashlib.sha256(digest_source.encode()).hexdigest()
    combined = settings.temp_dir / f"turn-{digest}.wav"
    if not combined.exists():
        concatenate_wavs(segments, combined, trim_silence=trim_silence)
    return combined
