from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv() -> None:
    """Load KEY=VALUE pairs from backend/.env without requiring python-dotenv."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        os.environ.setdefault(key, value)


_load_dotenv()


@dataclass(frozen=True)
class Settings:
    engine: str = os.getenv("TTS_ENGINE", "kokoro")
    default_voice: str = os.getenv("DEFAULT_VOICE", "af_heart")
    default_speed: float = float(os.getenv("DEFAULT_SPEED", "1.0"))
    speaker_change_pause: float = float(os.getenv("SPEAKER_CHANGE_PAUSE", "2.5"))
    output_format: str = os.getenv("OUTPUT_FORMAT", "wav")
    kokoro_device: str = os.getenv("KOKORO_DEVICE", "auto")
    # Bind to loopback by default; set API_HOST=0.0.0.0 only if you intentionally expose LAN.
    api_host: str = os.getenv("API_HOST", "127.0.0.1")
    api_port: int = int(os.getenv("API_PORT", "8000"))
    max_lecture_chars: int = int(os.getenv("MAX_LECTURE_CHARS", "200000"))
    output_dir: Path = ROOT / "output"
    temp_dir: Path = ROOT / "temp"
    data_dir: Path = ROOT / "data"

    def ensure_directories(self) -> None:
        for directory in (self.output_dir, self.temp_dir, self.data_dir):
            directory.mkdir(parents=True, exist_ok=True)
            (self.data_dir / "models").mkdir(parents=True, exist_ok=True)
            (self.data_dir / "voices").mkdir(parents=True, exist_ok=True)
            (self.data_dir / "benchmarks").mkdir(parents=True, exist_ok=True)
            (self.data_dir / "voice_samples").mkdir(parents=True, exist_ok=True)

    @property
    def kokoro_torch_device(self) -> str | None:
        """Kokoro expects None for auto device selection."""
        value = self.kokoro_device.strip().lower()
        if value in ("", "auto"):
            return None
        return self.kokoro_device


settings = Settings()
