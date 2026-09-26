from __future__ import annotations

from pathlib import Path
from threading import Thread
from time import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.audio.concatenate import concatenate_wavs
from app.audio.mp3 import wav_to_mp3
from app.config import settings
from app.models.schemas import ConversationRequest, HistoryItem, PreviewRequest, Project, Voice
from app.services.history import add_history, delete_history, list_history
from app.services.jobs import jobs
from app.services.parser import parse_conversation
from app.services.storage import delete_project, list_projects, save_project
from app.services.synthesis import synthesize_turn, unique_output_path
from app.tts.kokoro_engine import KokoroEngine
from app.tts.voices import VOICES

settings.ensure_directories()
engine = KokoroEngine()
app = FastAPI(title="Dialogue TTS", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])
app.mount("/audio", StaticFiles(directory=settings.output_dir), name="audio")
app.mount("/preview", StaticFiles(directory=settings.temp_dir), name="preview")


def fail(error: Exception) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))


def run_generation(job_id: str, request: ConversationRequest) -> None:
    speaker_map = {speaker.id: speaker for speaker in request.speakers}
    jobs.update(job_id, status="running", stage="Starting synthesis…", current=0)
    try:
        segments: list[tuple[Path, float]] = []
        total = len(request.messages)
        for index, message in enumerate(request.messages):
            speaker = speaker_map.get(message.speaker_id)
            if not speaker:
                raise ValueError(f"Message {index + 1} references an unknown speaker.")
            jobs.update(
                job_id,
                stage=f"Synthesizing turn {index + 1} of {total} ({speaker.name})",
                current=index,
            )
            segment = synthesize_turn(engine, message.text, speaker.voice_id, speaker.speed)
            changing = index < total - 1 and request.messages[index + 1].speaker_id != message.speaker_id
            pause = request.speaker_change_pause if changing else (0.35 if index < total - 1 else 0)
            segments.append((segment, pause))
            jobs.update(job_id, current=index + 1)

        jobs.update(job_id, stage="Combining audio…", current=total)
        output = unique_output_path(request.topic, "wav")
        concatenate_wavs(segments, output)
        jobs.update(job_id, stage="Encoding MP3…")
        mp3_output = output.with_suffix(".mp3")
        wav_to_mp3(output, mp3_output)
        url = f"/audio/{output.name}"
        mp3_url = f"/audio/{mp3_output.name}"
        history = add_history(
            request.topic.strip(),
            output.name,
            url,
            len(segments),
            mp3_filename=mp3_output.name,
            mp3_url=mp3_url,
        )
        jobs.update(
            job_id,
            status="done",
            stage="Ready",
            percent=100,
            eta_seconds=0,
            url=url,
            filename=output.name,
            mp3_url=mp3_url,
            mp3_filename=mp3_output.name,
            history_id=history.id,
            finished_at=time(),
        )
    except Exception as error:  # noqa: BLE001 - surface any synthesis failure to the job UI
        jobs.update(job_id, status="error", stage="Failed", error=str(error), eta_seconds=None, finished_at=time())


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"engine": "Kokoro", "device": settings.kokoro_device}


@app.get("/api/voices", response_model=list[Voice])
def voices() -> list[Voice]:
    return VOICES


@app.post("/api/parse")
def parse(payload: dict[str, str]):
    try:
        return parse_conversation(payload.get("text", ""))
    except ValueError as error:
        raise fail(error)


@app.post("/api/preview")
def preview(request: PreviewRequest) -> dict[str, str]:
    try:
        path = synthesize_turn(engine, request.text, request.voice_id, request.speed)
        return {"url": f"/preview/{path.name}"}
    except (ValueError, RuntimeError) as error:
        raise fail(error)


@app.post("/api/generate")
def generate(request: ConversationRequest) -> dict:
    job = jobs.create(total=len(request.messages))
    Thread(target=run_generation, args=(job.id, request), daemon=True).start()
    return job.to_dict()


@app.get("/api/generate/{job_id}")
def generate_status(job_id: str) -> dict:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job.to_dict()


@app.get("/api/history", response_model=list[HistoryItem])
def history() -> list[HistoryItem]:
    return list_history()


@app.delete("/api/history/{item_id}", response_model=HistoryItem)
def remove_history(item_id: str) -> HistoryItem:
    item = delete_history(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="History item not found.")
    return item


@app.get("/api/projects", response_model=list[Project])
def projects() -> list[Project]:
    return list_projects()


@app.put("/api/projects/{project_id}", response_model=Project)
def put_project(project_id: str, project: Project) -> Project:
    if project.id != project_id:
        raise HTTPException(status_code=400, detail="Project ID does not match URL.")
    return save_project(project)


@app.delete("/api/projects/{project_id}")
def remove_project(project_id: str) -> dict[str, str]:
    if not delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"status": "deleted", "id": project_id}
