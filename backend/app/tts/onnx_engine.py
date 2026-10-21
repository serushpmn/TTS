from __future__ import annotations

import hashlib
from pathlib import Path
from threading import Lock
import wave

import numpy as np
import onnxruntime as ort

from app.config import settings
from app.tts.voices import find_voice


def create_safe_session(model_path: Path) -> ort.InferenceSession:
    """
    Load an ONNX Kokoro graph without aggressive ORT optimizations.

    On Windows + onnxruntime 1.31, default graph optimization can access-violate
    on some Kokoro quantizations (verified with model_q8f16). Disabling
    optimizations keeps inference correct and stable.
    """
    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
    return ort.InferenceSession(
        str(model_path),
        sess_options=options,
        providers=["CPUExecutionProvider"],
    )


class OnnxKokoroEngine:
    """ONNX Runtime Kokoro via kokoro-onnx, bound to one local model file."""

    sample_rate = 24000

    def __init__(self, model_id: str, model_path: Path, voices_path: Path) -> None:
        self.model_id = model_id
        self.model_path = model_path
        self.voices_path = voices_path
        self._lock = Lock()
        self._kokoro = None
        self._load()

    def _load(self) -> None:
        if not self.model_path.is_file():
            raise FileNotFoundError(
                f"ONNX model file is missing: {self.model_path.name}. Download it before loading."
            )
        if not self.voices_path.is_file():
            raise FileNotFoundError(
                f"Voice pack is missing: {self.voices_path.name}. Download voices before loading."
            )
        try:
            from kokoro_onnx import Kokoro
        except ImportError as error:
            raise RuntimeError(
                "kokoro-onnx is not installed. Run: pip install kokoro-onnx onnxruntime"
            ) from error
        session = create_safe_session(self.model_path)
        # Kokoro.from_session expects session._model_path in some versions; set it defensively.
        if not hasattr(session, "_model_path"):
            session._model_path = str(self.model_path)  # type: ignore[attr-defined]
        self._kokoro = Kokoro.from_session(session, str(self.voices_path))

    @staticmethod
    def cache_key(text: str, voice_id: str, speed: float, model_id: str) -> str:
        return hashlib.sha256(f"{model_id}|{text}|{voice_id}|{speed}".encode()).hexdigest()

    def synthesize(self, text: str, voice_id: str, speed: float) -> Path:
        find_voice(voice_id)
        text = " ".join(text.split())
        if not text:
            raise ValueError("Dialogue text cannot be empty.")
        path = settings.temp_dir / f"{self.cache_key(text, voice_id, speed, self.model_id)}.wav"
        if path.exists():
            return path
        lang = "en-gb" if voice_id.startswith("b") else "en-us"
        with self._lock:
            if self._kokoro is None:
                raise RuntimeError("ONNX engine is not loaded.")
            try:
                audio, rate = self._kokoro.create(text, voice=voice_id, speed=speed, lang=lang)
            except Exception as error:
                raise RuntimeError(f"ONNX Kokoro could not generate this message: {error}") from error
        if audio is None or len(audio) == 0:
            raise RuntimeError("ONNX Kokoro returned no audio for this message.")
        pcm = np.clip(np.asarray(audio, dtype=np.float32).ravel(), -1, 1)
        with wave.open(str(path), "wb") as wav:
            wav.setparams((1, 2, int(rate) or self.sample_rate, 0, "NONE", "not compressed"))
            wav.writeframes((pcm * 32767).astype("<i2").tobytes())
        return path

    def unload(self) -> None:
        with self._lock:
            self._kokoro = None
