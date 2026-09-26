from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock
from time import time
from typing import Any
from uuid import uuid4


@dataclass
class Job:
    id: str
    status: str = "queued"
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
    error: str | None = None
    started_at: float = field(default_factory=time)
    finished_at: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "status": self.status,
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
            "error": self.error,
        }


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = Lock()

    def create(self, total: int) -> Job:
        # Rough CPU cold-start estimate; refined once real turn timings arrive.
        estimate = max(total, 1) * 4.5
        job = Job(
            id=uuid4().hex,
            total=total,
            stage="Preparing…",
            eta_seconds=estimate,
        )
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def update(self, job_id: str, **fields: Any) -> Job | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            for key, value in fields.items():
                setattr(job, key, value)
            if job.total > 0 and job.current >= 0:
                job.percent = min(100.0, (job.current / job.total) * 100)
            if job.status == "running" and job.current > 0:
                elapsed = time() - job.started_at
                per_item = elapsed / job.current
                remaining = max(job.total - job.current, 0)
                job.eta_seconds = per_item * remaining
            elif job.status in ("queued", "running") and job.current == 0:
                elapsed = time() - job.started_at
                baseline = max(job.total, 1) * 4.5
                job.eta_seconds = max(baseline - elapsed, 1.0)
            return job


jobs = JobStore()
