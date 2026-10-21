from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import benchmark, generate, history, models, projects, voices
from app.config import settings

settings.ensure_directories()

app = FastAPI(title="Dialogue Studio", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/audio", StaticFiles(directory=settings.output_dir), name="audio")
app.mount("/preview", StaticFiles(directory=settings.temp_dir), name="preview")

app.include_router(voices.router)
app.include_router(models.router)
app.include_router(generate.router)
app.include_router(history.router)
app.include_router(projects.router)
app.include_router(benchmark.router)
