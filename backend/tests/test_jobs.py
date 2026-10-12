from __future__ import annotations

from app.services.jobs import JobStore


def test_cancel_marks_job_cancelled():
    store = JobStore()
    job = store.create(total=3)
    cancelled = store.cancel(job.id)
    assert cancelled is not None
    assert cancelled.status == "cancelled"
    assert cancelled.cancel_requested is True
    assert store.is_cancelled(job.id) is True


def test_update_ignored_after_cancel():
    store = JobStore()
    job = store.create(total=4)
    store.cancel(job.id)
    store.update(job.id, status="running", current=2, stage="Still going")
    latest = store.get(job.id)
    assert latest is not None
    assert latest.status == "cancelled"
    assert latest.stage == "Cancelled"
