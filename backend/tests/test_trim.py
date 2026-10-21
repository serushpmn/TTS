from __future__ import annotations

from pathlib import Path
import wave

import numpy as np

from app.audio.trim import trim_wav_silence


def _write(path: Path, samples: np.ndarray, rate: int = 24000) -> None:
    pcm = samples.astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setparams((1, 2, rate, pcm.size, "NONE", "not compressed"))
        wav.writeframes(pcm.tobytes())


def test_trim_removes_leading_and_trailing_silence(tmp_path: Path):
    rate = 24000
    silence = np.zeros(rate, dtype=np.int16)
    speech = (np.ones(rate // 2) * 10000).astype(np.int16)
    full = np.concatenate([silence, speech, silence])
    source = tmp_path / "in.wav"
    dest = tmp_path / "out.wav"
    _write(source, full, rate)
    trim_wav_silence(source, dest, threshold=0.02, pad_ms=0)
    with wave.open(str(dest), "rb") as wav:
        frames = wav.getnframes()
    assert frames < full.size
    assert frames >= speech.size
