from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import time
import wave
from uuid import uuid4

from app.config import settings
from app.services.atomic import atomic_write_json
from app.services.synthesis import synthesize_turn
from app.tts.factory import engine_hub
from app.tts.model_manager import model_manager
from app.tts.registry import require_variant


def _audio_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / float(wav.getframerate())


def _peak_memory_mb() -> float | None:
    try:
        import os

        import psutil  # type: ignore

        process = psutil.Process(os.getpid())
        return process.memory_info().rss / (1024 * 1024)
    except Exception:  # noqa: BLE001
        return None


def run_benchmark(
    model_ids: list[str],
    text: str,
    voice_id: str,
    speed: float,
    include_listening_samples: bool = False,
) -> dict:
    settings.ensure_directories()
    targets = model_ids or [
        item["id"]
        for item in model_manager.list_models()
        if item["installed"] and (item["runtime"] == "torch" or model_manager.voices_installed())
    ]
    results = []
    for model_id in targets:
        entry: dict = {
            "model_id": model_id,
            "measured": True,
            "error": None,
        }
        try:
            variant = require_variant(model_id)
            entry["precision"] = variant.precision
            entry["disk_bytes"] = (
                None
                if variant.runtime == "torch"
                else (model_manager.model_path(model_id).stat().st_size if model_manager.is_installed(model_id) else None)
            )
            model_manager.ensure_assets_for(model_id)
            engine_hub.unload()
            load_started = time.perf_counter()
            engine = engine_hub.get(model_id)
            entry["load_seconds"] = time.perf_counter() - load_started

            # Cold / first generation
            cold_key = settings.temp_dir / f"bench-cold-{uuid4().hex}.wav"
            # Force miss by unique whitespace padding that markup normalizes — use unique suffix in text.
            cold_text = f"{text} ({uuid4().hex[:8]})"
            first_started = time.perf_counter()
            cold_path = synthesize_turn(cold_text, voice_id, speed, engine=engine, model_id=model_id)
            entry["first_generation_seconds"] = time.perf_counter() - first_started
            # Warm: same text hits cache — measure engine path with another unique line once, then repeat synth of identical inputs.
            warm_text = f"{text} warm-{uuid4().hex[:8]}"
            synthesize_turn(warm_text, voice_id, speed, engine=engine, model_id=model_id)
            warm_started = time.perf_counter()
            warm_path = synthesize_turn(warm_text, voice_id, speed, engine=engine, model_id=model_id)
            entry["warm_generation_seconds"] = time.perf_counter() - warm_started

            duration = _audio_duration(warm_path)
            entry["audio_duration_seconds"] = duration
            entry["total_generation_seconds"] = entry["first_generation_seconds"]
            entry["realtime_factor"] = (
                entry["first_generation_seconds"] / duration if duration > 0 else None
            )
            entry["peak_memory_mb"] = _peak_memory_mb()
            entry["sample_url"] = None
            if include_listening_samples:
                sample_name = f"bench-{model_id}-{uuid4().hex[:8]}.wav"
                sample_path = settings.temp_dir / sample_name
                sample_path.write_bytes(Path(cold_path).read_bytes())
                entry["sample_url"] = f"/preview/{sample_name}"
            # Avoid leaving empty placeholder files.
            if cold_key.exists():
                cold_key.unlink()
        except Exception as error:  # noqa: BLE001
            entry["error"] = str(error)
            entry["measured"] = False
        results.append(entry)

    payload = {
        "id": uuid4().hex,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "text": text,
        "voice_id": voice_id,
        "speed": speed,
        "results": results,
        "notes": [
            "All timings are measured on this machine.",
            "Warm generation may hit the on-disk segment cache.",
            "Peak memory is best-effort and may be unavailable without psutil.",
            "Do not treat speed or size as a substitute for listening quality.",
        ],
    }
    out = settings.data_dir / "benchmarks" / f"{payload['id']}.json"
    atomic_write_json(out, payload)
    return payload


def list_benchmarks() -> list[dict]:
    root = settings.data_dir / "benchmarks"
    if not root.exists():
        return []
    items = []
    for path in sorted(root.glob("*.json"), reverse=True):
        try:
            items.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return items
