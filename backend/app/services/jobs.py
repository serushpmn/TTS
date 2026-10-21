from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock
from time import time
from typing import Any
from uuid import uuid4


JOB_STATUSES = (
    "pending",
    "initializing_model",
    "generating",
    "combining",
    "exporting",
    "completed",
    "failed",
    "cancelled",
    # Legacy aliases kept for older clients during transition.
    "queued",
    "running",
    "done",
    "error",
)


@dataclass
class Job:
    id: str
    status: str = "pending"
    stage: str = "Waiting to start"
    current: int = 0
    total: int = 0
    percent: float = 0.0
    eta_seconds: float | None = None
    url: str | None = None
    filename: str | None = None
    mp3_url: str | None = None
    mp3_filename: str | None = None
    history_id: str | None = None
    model_id: str | None = None
    error: str | None = None
    cancel_requested: bool = False
    output_paths: list[str] = field(default_factory=list)
    started_at: float = field(default_factory=time)
    finished_at: float | None = None

    def to_dict(self) -> dict[str, Any]:
        # Map internal statuses to both new and legacy fields for the UI.
        legacy = {
            "pending": "queued",
            "initializing_model": "running",
            "generating": "running",
            "combining": "running",
            "exporting": "running",
            "completed": "done",
            "failed": "error",
            "cancelled": "cancelled",
        }.get(self.status, self.status)
        return {
            "id": self.id,
            "status": legacy,
            "status_detail": self.status,
            "stage": self.stage,
            "current": self.current,
            "total": self.total,
            "percent": round(self.percent, 1),
            "eta_seconds": None if self.eta_seconds is None else round(self.eta_seconds, 1),
            "url": self.url,
            "filename": self.filename,
            "mp3_url": self.mp3_url,
            "mp3_filename": self.mp3_filename,
            "history_id": self.history_id,
            "model_id": self.model_id,
            "error": self.error,
        }


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = Lock()
        self._active_generation: str | None = None

    def create(self, total: int, model_id: str | None = None) -> Job:
        estimate = max(total, 1) * 4.5
        job = Job(
            id=uuid4().hex,
            total=total,
            status="pending",
            stage="Preparing…",
            eta_seconds=estimate,
            model_id=model_id,
        )
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def try_begin(self, job_id: str) -> bool:
        """Prevent accidental overlapping generation jobs on this local instance."""
        with self._lock:
            if self._active_generation and self._active_generation != job_id:
                active = self._jobs.get(self._active_generation)
                if active and active.status not in (
                    "completed",
                    "failed",
                    "cancelled",
                    "done",
                    "error",
                ):
                    return False
            self._active_generation = job_id
            return True

    def end(self, job_id: str) -> None:
        with self._lock:
            if self._active_generation == job_id:
                self._active_generation = None

    def cancel(self, job_id: str) -> Job | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            if job.status in ("completed", "failed", "cancelled", "done", "error"):
                return job
            job.cancel_requested = True
            job.status = "cancelled"
            job.stage = "Cancelled"
            job.eta_seconds = None
            job.finished_at = time()
            if self._active_generation == job_id:
                self._active_generation = None
            return job

    def is_cancelled(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            return bool(job and (job.cancel_requested or job.status == "cancelled"))

    def track_output(self, job_id: str, path: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job and path not in job.output_paths:
                job.output_paths.append(path)

    def update(self, job_id: str, **fields: Any) -> Job | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            if job.cancel_requested or job.status == "cancelled":
                return job
            for key, value in fields.items():
                setattr(job, key, value)
            if job.total > 0 and job.current >= 0 and job.status != "cancelled":
                job.percent = min(100.0, (job.current / job.total) * 100)
            runningish = job.status in (
                "pending",
                "queued",
                "initializing_model",
                "generating",
                "combining",
                "exporting",
                "running",
            )
            if runningish and job.current > 0:
                elapsed = time() - job.started_at
                per_item = elapsed / job.current
                remaining = max(job.total - job.current, 0)
                job.eta_seconds = per_item * remaining
            elif runningish and job.current == 0:
                elapsed = time() - job.started_at
                baseline = max(job.total, 1) * 4.5
                job.eta_seconds = max(baseline - elapsed, 1.0)
            return job


jobs = JobStore()
