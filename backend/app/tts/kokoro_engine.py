from __future__ import annotations

import hashlib
from pathlib import Path
from threading import Lock
import wave

import numpy as np

from app.config import settings
from app.tts.voices import find_voice


class KokoroEngine:
    sample_rate = 24000

    def __init__(self) -> None:
        self._pipelines: dict[str, object] = {}
        self._lock = Lock()

    def _pipeline(self, voice_id: str):
        find_voice(voice_id)
        lang = "a" if voice_id.startswith("a") else "b"
        with self._lock:
            if lang not in self._pipelines:
                try:
                    from kokoro import KPipeline
                except ImportError as error:
                    raise RuntimeError("Kokoro is not installed. Run pip install -r requirements.txt.") from error
                self._pipelines[lang] = KPipeline(
                    lang_code=lang,
                    device=settings.kokoro_torch_device,
                )
            return self._pipelines[lang]

    @staticmethod
    def cache_key(text: str, voice_id: str, speed: float) -> str:
        return hashlib.sha256(f"{text}|{voice_id}|{speed}".encode()).hexdigest()

    def synthesize(self, text: str, voice_id: str, speed: float) -> Path:
        text = " ".join(text.split())
        if not text:
            raise ValueError("Dialogue text cannot be empty.")
        path = settings.temp_dir / f"{self.cache_key(text, voice_id, speed)}.wav"
        if path.exists():
            return path
        try:
            chunks = [np.asarray(result.audio, dtype=np.float32) for result in self._pipeline(voice_id)(text, voice=voice_id, speed=speed)]
        except Exception as error:
            raise RuntimeError(f"Kokoro could not generate this message: {error}") from error
        if not chunks:
            raise RuntimeError("Kokoro returned no audio for this message.")
        # Keep output broadly compatible and avoid needing FFmpeg or a native WAV
        # encoder. Kokoro emits normalized float audio at 24 kHz.
        pcm = np.clip(np.concatenate(chunks), -1, 1)
        with wave.open(str(path), "wb") as wav:
            wav.setparams((1, 2, self.sample_rate, 0, "NONE", "not compressed"))
            wav.writeframes((pcm * 32767).astype("<i2").tobytes())
        return path
