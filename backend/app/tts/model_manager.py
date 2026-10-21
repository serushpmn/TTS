from __future__ import annotations

import hashlib
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from time import time
from typing import Any
from uuid import uuid4

from app.config import settings
from app.services.prefs import save_prefs, selected_model_id
from app.tts.registry import (
    TORCH_ENGINE_ID,
    VOICES_APPROX_BYTES,
    VOICES_FILENAME,
    VOICES_URL,
    ModelVariant,
    all_variants,
    get_variant,
    require_variant,
)


@dataclass
class DownloadJob:
    id: str
    target: str  # model id or "voices"
    status: str = "queued"
    progress: float = 0.0
    bytes_downloaded: int = 0
    bytes_total: int | None = None
    error: str | None = None
    cancel_requested: bool = False
    started_at: float = field(default_factory=time)
    finished_at: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "target": self.target,
            "status": self.status,
            "progress": round(self.progress, 1),
            "bytes_downloaded": self.bytes_downloaded,
            "bytes_total": self.bytes_total,
            "error": self.error,
        }


class ModelManager:
    """Local ONNX model + voice pack manager (download, verify, delete, status)."""

    def __init__(self) -> None:
        self.models_dir = settings.data_dir / "models"
        self.voices_dir = settings.data_dir / "voices"
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.voices_dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._downloads: dict[str, DownloadJob] = {}
        self._loaded_model_id: str | None = None

    @property
    def voices_path(self) -> Path:
        return self.voices_dir / VOICES_FILENAME

    def model_path(self, model_id: str) -> Path:
        variant = require_variant(model_id)
        if variant.runtime == "torch":
            return Path()
        return self.models_dir / variant.filename

    def is_installed(self, model_id: str) -> bool:
        variant = get_variant(model_id)
        if not variant:
            return False
        if variant.runtime == "torch":
            return True
        path = self.model_path(model_id)
        return path.is_file() and path.stat().st_size > 1_000_000

    def voices_installed(self) -> bool:
        path = self.voices_path
        return path.is_file() and path.stat().st_size > 1_000_000

    def set_loaded(self, model_id: str | None) -> None:
        with self._lock:
            self._loaded_model_id = model_id

    def loaded_model_id(self) -> str | None:
        with self._lock:
            return self._loaded_model_id

    def disk_usage_bytes(self) -> int:
        total = 0
        for directory in (self.models_dir, self.voices_dir):
            if not directory.exists():
                continue
            for path in directory.rglob("*"):
                if path.is_file():
                    total += path.stat().st_size
        return total

    def status_for(self, variant: ModelVariant) -> dict[str, Any]:
        installed = self.is_installed(variant.id)
        path = self.model_path(variant.id) if variant.runtime == "onnx" else None
        size = path.stat().st_size if path and path.is_file() else None
        integrity = "n/a"
        if variant.runtime == "onnx" and installed and path:
            integrity = self._verify_file(path, variant.approx_bytes, variant.sha256)
        return {
            **variant.to_public_dict(),
            "installed": installed,
            "loaded": self.loaded_model_id() == variant.id,
            "selected": selected_model_id() == variant.id,
            "local_bytes": size,
            "integrity": integrity,
            "path": str(path) if path and installed else None,
            "voices_required": variant.runtime == "onnx",
            "voices_installed": self.voices_installed() if variant.runtime == "onnx" else True,
            "compatible": True,
            "compatibility_note": (
                "Uses installed PyTorch + Kokoro packages."
                if variant.runtime == "torch"
                else "Requires onnxruntime and a local voice pack."
            ),
        }

    def list_models(self) -> list[dict[str, Any]]:
        return [self.status_for(item) for item in all_variants()]

    def offline_status(self) -> dict[str, Any]:
        selected = selected_model_id()
        variant = require_variant(selected)
        ready = self.is_installed(selected) and (
            variant.runtime == "torch" or self.voices_installed()
        )
        return {
            "selected_model_id": selected,
            "runtime": variant.runtime,
            "model_installed": self.is_installed(selected),
            "voices_installed": self.voices_installed(),
            "offline_ready": ready,
            "loaded_model_id": self.loaded_model_id(),
            "disk_usage_bytes": self.disk_usage_bytes(),
            "models_dir": str(self.models_dir),
            "voices_dir": str(self.voices_dir),
            "note": (
                "Inference, editing, playback, export, and history work offline once the "
                "selected model and required voice assets are present."
            ),
        }

    def select_model(self, model_id: str) -> dict[str, Any]:
        require_variant(model_id)
        save_prefs({"selected_model_id": model_id})
        return self.status_for(require_variant(model_id))

    def delete_model(self, model_id: str) -> dict[str, Any]:
        variant = require_variant(model_id)
        if variant.runtime == "torch":
            raise ValueError("The PyTorch engine is not a deletable download.")
        path = self.model_path(model_id)
        if path.is_file():
            path.unlink()
        if selected_model_id() == model_id:
            # Do not silently pick another ONNX file; fall back to explicit Torch engine.
            save_prefs({"selected_model_id": TORCH_ENGINE_ID})
        if self.loaded_model_id() == model_id:
            self.set_loaded(None)
        return self.status_for(variant)

    def get_download(self, job_id: str) -> DownloadJob | None:
        with self._lock:
            return self._downloads.get(job_id)

    def cancel_download(self, job_id: str) -> DownloadJob | None:
        with self._lock:
            job = self._downloads.get(job_id)
            if not job:
                return None
            if job.status in ("done", "error", "cancelled"):
                return job
            job.cancel_requested = True
            job.status = "cancelled"
            job.finished_at = time()
            return job

    def start_download_model(self, model_id: str) -> DownloadJob:
        variant = require_variant(model_id)
        if variant.runtime != "onnx":
            raise ValueError("Only ONNX model variants can be downloaded.")
        job = DownloadJob(id=uuid4().hex, target=model_id, status="running")
        with self._lock:
            self._downloads[job.id] = job
        return job

    def start_download_voices(self) -> DownloadJob:
        job = DownloadJob(id=uuid4().hex, target="voices", status="running")
        with self._lock:
            self._downloads[job.id] = job
        return job

    def run_download_model(self, job_id: str, model_id: str) -> None:
        variant = require_variant(model_id)
        dest = self.model_path(model_id)
        url = (
            f"https://huggingface.co/{variant.repo}/resolve/{variant.revision}/"
            f"{variant.repo_path}"
        )
        self._download_file(
            job_id,
            url,
            dest,
            expected_bytes=variant.approx_bytes,
            sha256=variant.sha256,
            size_tolerance=0.35,
        )

    def run_download_voices(self, job_id: str) -> None:
        self._download_file(
            job_id,
            VOICES_URL,
            self.voices_path,
            expected_bytes=VOICES_APPROX_BYTES,
            sha256=None,
            size_tolerance=0.5,
        )

    def ensure_assets_for(self, model_id: str) -> None:
        variant = require_variant(model_id)
        if variant.runtime == "torch":
            return
        if not self.is_installed(model_id):
            raise FileNotFoundError(
                f"Model '{model_id}' is not installed. Download it before generating."
            )
        if not self.voices_installed():
            raise FileNotFoundError(
                "Voice pack is not installed. Download voices before generating with ONNX."
            )

    def _verify_file(self, path: Path, expected_bytes: int | None, sha256: str | None) -> str:
        if not path.is_file():
            return "missing"
        size = path.stat().st_size
        if size < 1_000_000:
            return "incomplete"
        if expected_bytes and abs(size - expected_bytes) / expected_bytes > 0.35:
            return "size_mismatch"
        if sha256:
            digest = self._sha256(path)
            if digest.lower() != sha256.lower():
                return "checksum_failed"
            return "verified"
        return "present"

    @staticmethod
    def _sha256(path: Path) -> str:
        hasher = hashlib.sha256()
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(1024 * 1024)
                if not chunk:
                    break
                hasher.update(chunk)
        return hasher.hexdigest()

    def _update_job(self, job_id: str, **fields: Any) -> DownloadJob | None:
        with self._lock:
            job = self._downloads.get(job_id)
            if not job:
                return None
            if job.cancel_requested and fields.get("status") not in ("cancelled",):
                # Allow progress fields only if not forcing a terminal success.
                if fields.get("status") in ("done", "error"):
                    return job
            for key, value in fields.items():
                setattr(job, key, value)
            return job

    def _is_cancelled(self, job_id: str) -> bool:
        with self._lock:
            job = self._downloads.get(job_id)
            return bool(job and (job.cancel_requested or job.status == "cancelled"))

    def _download_file(
        self,
        job_id: str,
        url: str,
        dest: Path,
        expected_bytes: int | None,
        sha256: str | None,
        size_tolerance: float,
    ) -> None:
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".partial")
        try:
            # Resume when a partial file already exists.
            existing = tmp.stat().st_size if tmp.exists() else 0
            headers = {"User-Agent": "DialogueStudio/1.0"}
            if existing > 0:
                headers["Range"] = f"bytes={existing}-"
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=120) as response:
                total_header = response.headers.get("Content-Length")
                content_range = response.headers.get("Content-Range")
                if content_range and "/" in content_range:
                    try:
                        total = int(content_range.split("/")[-1])
                    except ValueError:
                        total = int(total_header) + existing if total_header else None
                elif response.status == 206 and total_header:
                    total = existing + int(total_header)
                else:
                    total = int(total_header) if total_header else expected_bytes
                    if response.status != 206:
                        existing = 0
                        if tmp.exists():
                            tmp.unlink()
                mode = "ab" if existing and response.status == 206 else "wb"
                downloaded = existing if mode == "ab" else 0
                self._update_job(
                    job_id,
                    status="running",
                    bytes_total=total,
                    bytes_downloaded=downloaded,
                    progress=(downloaded / total * 100) if total else 0,
                )
                with tmp.open(mode) as handle:
                    while True:
                        if self._is_cancelled(job_id):
                            return
                        chunk = response.read(1024 * 256)
                        if not chunk:
                            break
                        handle.write(chunk)
                        downloaded += len(chunk)
                        progress = (downloaded / total * 100) if total else 0
                        self._update_job(
                            job_id,
                            bytes_downloaded=downloaded,
                            bytes_total=total,
                            progress=min(progress, 99.9),
                        )
            if self._is_cancelled(job_id):
                return
            if not tmp.exists() or tmp.stat().st_size < 1_000_000:
                raise RuntimeError("Download incomplete or corrupted.")
            size = tmp.stat().st_size
            if expected_bytes and abs(size - expected_bytes) / expected_bytes > size_tolerance:
                raise RuntimeError(
                    f"Downloaded size {size} differs too much from expected ~{expected_bytes}."
                )
            if sha256:
                digest = self._sha256(tmp)
                if digest.lower() != sha256.lower():
                    tmp.unlink(missing_ok=True)
                    raise RuntimeError("SHA-256 checksum mismatch. File deleted.")
            if dest.exists():
                dest.unlink()
            tmp.replace(dest)
            self._update_job(
                job_id,
                status="done",
                progress=100,
                bytes_downloaded=dest.stat().st_size,
                bytes_total=dest.stat().st_size,
                finished_at=time(),
            )
        except Exception as error:  # noqa: BLE001
            if self._is_cancelled(job_id):
                return
            message = str(error)
            if isinstance(error, urllib.error.URLError):
                message = f"Network error: {error.reason}"
            self._update_job(job_id, status="error", error=message, finished_at=time())
            # Keep .partial for resume unless checksum failed (already removed).


model_manager = ModelManager()
