from __future__ import annotations

from app.services.jobs import JobStore


def test_try_begin_blocks_second_job():
    store = JobStore()
    first = store.create(total=2)
    second = store.create(total=2)
    assert store.try_begin(first.id) is True
    assert store.try_begin(second.id) is False
    store.end(first.id)
    assert store.try_begin(second.id) is True


def test_status_detail_mapping():
    store = JobStore()
    job = store.create(total=1)
    store.update(job.id, status="generating", current=0)
    payload = store.get(job.id).to_dict()
    assert payload["status"] == "running"
    assert payload["status_detail"] == "generating"
