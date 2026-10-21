from __future__ import annotations

import hashlib
from pathlib import Path
from threading import Lock
import wave

import numpy as np

from app.config import settings
from app.tts.languages import ensure_lang_registered, resolve_lang_for_voice
from app.tts.registry import TORCH_ENGINE_ID
from app.tts.voices import find_voice


class TorchKokoroEngine:
    """Existing PyTorch Kokoro pipeline, wrapped as a selectable engine."""

    sample_rate = 24000
    model_id = TORCH_ENGINE_ID

    def __init__(self) -> None:
        self._pipelines: dict[str, object] = {}
        self._lock = Lock()

    def _pipeline(self, lang_code: str):
        ensure_lang_registered(lang_code)
        with self._lock:
            if lang_code not in self._pipelines:
                try:
                    from kokoro import KPipeline
                except ImportError as error:
                    raise RuntimeError(
                        "Kokoro is not installed. Run pip install -r requirements.txt."
                    ) from error
                self._pipelines[lang_code] = KPipeline(
                    lang_code=lang_code,
                    repo_id="hexgrad/Kokoro-82M",
                    device=settings.kokoro_torch_device,
                )
            return self._pipelines[lang_code]

    @staticmethod
    def cache_key(
        text: str,
        voice_id: str,
        speed: float,
        model_id: str = TORCH_ENGINE_ID,
        lang_id: str = "en-us",
    ) -> str:
        return hashlib.sha256(
            f"{model_id}|{lang_id}|{text}|{voice_id}|{speed}".encode()
        ).hexdigest()

    def synthesize(
        self,
        text: str,
        voice_id: str,
        speed: float,
        *,
        synth_lang: str | None = None,
    ) -> Path:
        find_voice(voice_id)
        text = " ".join(text.split())
        if not text:
            raise ValueError("Dialogue text cannot be empty.")
        language = resolve_lang_for_voice(voice_id, synth_lang)
        if language.engine == "onnx":
            raise RuntimeError(f"Language {language.id} is not available on the Torch engine path.")
        path = settings.temp_dir / f"{self.cache_key(text, voice_id, speed, lang_id=language.id)}.wav"
        if path.exists():
            return path
        try:
            pipeline = self._pipeline(language.lang_code)
            chunks = [
                np.asarray(result.audio, dtype=np.float32)
                for result in pipeline(text, voice=voice_id, speed=speed)
                if getattr(result, "audio", None) is not None
            ]
        except Exception as error:
            raise RuntimeError(f"Kokoro could not generate this message: {error}") from error
        if not chunks:
            raise RuntimeError("Kokoro returned no audio for this message.")
        pcm = np.clip(np.concatenate(chunks), -1, 1)
        with wave.open(str(path), "wb") as wav:
            wav.setparams((1, 2, self.sample_rate, 0, "NONE", "not compressed"))
            wav.writeframes((pcm * 32767).astype("<i2").tobytes())
        return path

    def unload(self) -> None:
        with self._lock:
            self._pipelines.clear()


# Back-compat alias used by older imports / tests during migration.
KokoroEngine = TorchKokoroEngine
