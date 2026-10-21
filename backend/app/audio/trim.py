from __future__ import annotations

from pathlib import Path
import wave

import numpy as np


def trim_wav_silence(
    source: Path,
    destination: Path | None = None,
    *,
    threshold: float = 0.02,
    pad_ms: int = 40,
) -> Path:
    """
    Remove leading/trailing near-silence from a 16-bit PCM WAV.

    threshold: absolute peak fraction of full scale (0–1) treated as silence.
    pad_ms: keep this much silence at each edge so cuts are not abrupt.
    """
    dest = destination or source
    with wave.open(str(source), "rb") as wav:
        channels, width, rate, nframes = (
            wav.getnchannels(),
            wav.getsampwidth(),
            wav.getframerate(),
            wav.getnframes(),
        )
        if width != 2:
            raise ValueError("Only 16-bit PCM WAV can be trimmed.")
        raw = wav.readframes(nframes)

    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32)
    if channels > 1:
        samples = samples.reshape(-1, channels)
        mono = samples.mean(axis=1)
    else:
        mono = samples

    if mono.size == 0:
        if dest != source:
            dest.write_bytes(source.read_bytes())
        return dest

    peak = float(np.max(np.abs(mono))) or 1.0
    normalized = np.abs(mono) / peak
    active = np.where(normalized > threshold)[0]
    if active.size == 0:
        # Entirely silent — keep a short stub.
        keep = max(1, int(rate * 0.05))
        trimmed = samples[:keep] if channels == 1 else samples[:keep]
    else:
        pad = int(rate * pad_ms / 1000)
        start = max(0, int(active[0]) - pad)
        end = min(mono.size, int(active[-1]) + 1 + pad)
        trimmed = samples[start:end] if channels == 1 else samples[start:end]

    pcm = np.asarray(trimmed, dtype=np.int16)
    frames = pcm.size // channels
    with wave.open(str(dest), "wb") as out:
        out.setparams((channels, 2, rate, frames, "NONE", "not compressed"))
        out.writeframes(pcm.tobytes())
    return dest
