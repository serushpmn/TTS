from __future__ import annotations

from threading import Lock
from typing import Any

from app.services.prefs import selected_model_id
from app.tts.model_manager import model_manager
from app.tts.onnx_engine import OnnxKokoroEngine
from app.tts.registry import TORCH_ENGINE_ID, require_variant
from app.tts.torch_engine import TorchKokoroEngine


class EngineHub:
    """Process-wide engine holder. Only one ONNX/Torch backend is active."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._engine: TorchKokoroEngine | OnnxKokoroEngine | None = None
        self._torch: TorchKokoroEngine | None = None

    def current(self) -> TorchKokoroEngine | OnnxKokoroEngine | None:
        with self._lock:
            return self._engine

    def status(self) -> dict[str, Any]:
        with self._lock:
            engine = self._engine
            return {
                "loaded": engine is not None,
                "model_id": getattr(engine, "model_id", None),
                "sample_rate": getattr(engine, "sample_rate", None),
            }

    def get(self, model_id: str | None = None):
        """Return a ready engine for model_id (defaults to user preference)."""
        target = model_id or selected_model_id()
        variant = require_variant(target)
        with self._lock:
            if self._engine is not None and self._engine.model_id == target:
                return self._engine
            # Load target without destroying the previous engine until success.
            if variant.runtime == "torch":
                if self._torch is None:
                    self._torch = TorchKokoroEngine()
                new_engine: TorchKokoroEngine | OnnxKokoroEngine = self._torch
            else:
                model_manager.ensure_assets_for(target)
                new_engine = OnnxKokoroEngine(
                    model_id=target,
                    model_path=model_manager.model_path(target),
                    voices_path=model_manager.voices_path,
                )
            previous = self._engine
            self._engine = new_engine
            model_manager.set_loaded(target)
            if previous is not None and previous is not new_engine and previous.model_id != TORCH_ENGINE_ID:
                try:
                    previous.unload()
                except Exception:  # noqa: BLE001
                    pass
            return self._engine

    def unload(self) -> None:
        with self._lock:
            if self._engine is not None:
                try:
                    self._engine.unload()
                except Exception:  # noqa: BLE001
                    pass
            self._engine = None
            model_manager.set_loaded(None)

    def load_selected(self):
        return self.get(selected_model_id())


engine_hub = EngineHub()
