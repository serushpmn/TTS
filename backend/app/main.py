from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import benchmark, generate, history, models, projects, voices
from app.config import settings
from app.services.tone_samples import samples_dir as tone_samples_dir
from app.services.voice_samples import samples_dir

settings.ensure_directories()
samples_dir()
tone_samples_dir()

app = FastAPI(title="Dialogue Studio", version="1.2.0")
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
app.mount("/voice-samples", StaticFiles(directory=samples_dir()), name="voice-samples")
app.mount("/tone-samples", StaticFiles(directory=tone_samples_dir()), name="tone-samples")

app.include_router(voices.router)
app.include_router(models.router)
app.include_router(generate.router)
app.include_router(history.router)
app.include_router(projects.router)
app.include_router(benchmark.router)
