from __future__ import annotations

from pathlib import Path
from typing import Protocol, runtime_checkable


@runtime_checkable
class TTSEngine(Protocol):
    """Process-local text-to-speech backend."""

    sample_rate: int
    model_id: str

    def synthesize(self, text: str, voice_id: str, speed: float) -> Path:
        """Generate a mono 16-bit WAV and return its path."""
        ...

    def unload(self) -> None:
        """Release model weights / sessions when possible."""
        ...
