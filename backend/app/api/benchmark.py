from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter

from app.api.deps import fail
from app.models.schemas import BenchmarkRequest
from app.services.benchmark import list_benchmarks, run_benchmark

router = APIRouter(tags=["benchmark"])
_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="benchmark")


@router.get("/api/benchmarks")
def benchmarks() -> list[dict]:
    return list_benchmarks()


@router.post("/api/benchmarks")
def create_benchmark(request: BenchmarkRequest) -> dict:
    try:
        future = _pool.submit(
            run_benchmark,
            request.model_ids,
            request.text,
            request.voice_id,
            request.speed,
            request.include_listening_samples,
        )
        return future.result()
    except Exception as error:  # noqa: BLE001
        raise fail(error)
