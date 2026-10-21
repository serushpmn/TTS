from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Thread

from fastapi import APIRouter, HTTPException

from app.api.deps import fail
from app.audio.concatenate import concatenate_wavs
from app.audio.mp3 import wav_to_mp3
from app.models.schemas import (
    ConversationRequest,
    LecturePlan,
    LectureRequest,
    PreviewRequest,
    SegmentRegenRequest,
)
from app.services.generation import run_generation, run_lecture
from app.services.history import add_history
from app.services.jobs import jobs
from app.services.lecture import split_lecture_text
from app.services.parser import parse_conversation
from app.services.prefs import selected_model_id
from app.services.synthesis import synthesize_turn, unique_output_path
from app.tts.factory import engine_hub
from app.tts.model_manager import model_manager

router = APIRouter(tags=["generate"])
_preview_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="preview")


@router.post("/api/parse")
def parse(payload: dict[str, str]):
    try:
        return parse_conversation(payload.get("text", ""))
    except ValueError as error:
        raise fail(error)


@router.post("/api/preview")
def preview(request: PreviewRequest) -> dict[str, str]:
    model_id = request.model_id or selected_model_id()

    def work() -> str:
        model_manager.ensure_assets_for(model_id)
        engine = engine_hub.get(model_id)
        path = synthesize_turn(request.text, request.voice_id, request.speed, engine=engine, model_id=model_id)
        return path.name

    try:
        name = _preview_pool.submit(work).result()
        return {"url": f"/preview/{name}"}
    except Exception as error:  # noqa: BLE001
        raise fail(error)


@router.post("/api/generate")
def generate(request: ConversationRequest) -> dict:
    model_id = request.model_id or selected_model_id()
    job = jobs.create(total=len(request.messages), model_id=model_id)
    Thread(target=run_generation, args=(job.id, request), daemon=True).start()
    return job.to_dict()


@router.post("/api/lecture/plan", response_model=LecturePlan)
def lecture_plan(payload: dict) -> LecturePlan:
    try:
        chunks = split_lecture_text(str(payload.get("text", "")))
    except ValueError as error:
        raise fail(error)
    characters = sum(len(chunk) for chunk in chunks)
    try:
        speed = max(float(payload.get("speed", 1.0) or 1.0), 0.5)
    except (TypeError, ValueError):
        speed = 1.0
    try:
        section_pause = max(float(payload.get("section_pause", 0.85) or 0.85), 0.0)
    except (TypeError, ValueError):
        section_pause = 0.85
    speech_seconds = characters / (13.5 * speed)
    pause_seconds = max(len(chunks) - 1, 0) * section_pause
    return LecturePlan(
        chunks=chunks,
        count=len(chunks),
        characters=characters,
        estimated_seconds=max(1, int(round(speech_seconds + pause_seconds))),
    )


@router.post("/api/lecture")
def lecture(request: LectureRequest) -> dict:
    try:
        chunks = split_lecture_text(request.text)
    except ValueError as error:
        raise fail(error)
    model_id = request.model_id or selected_model_id()
    job = jobs.create(total=len(chunks), model_id=model_id)
    Thread(target=run_lecture, args=(job.id, request), daemon=True).start()
    return job.to_dict()


@router.get("/api/generate/{job_id}")
def generate_status(job_id: str) -> dict:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job.to_dict()


@router.post("/api/generate/{job_id}/cancel")
def cancel_generation(job_id: str) -> dict:
    job = jobs.cancel(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job.to_dict()


@router.post("/api/segments/regenerate")
def regenerate_segment(request: SegmentRegenRequest) -> dict:
    """Regenerate one dialogue line or lecture section and rebuild the final file."""
    model_id = request.model_id or selected_model_id()
    try:
        model_manager.ensure_assets_for(model_id)
        engine = engine_hub.get(model_id)
        segments: list[tuple[Path, float]] = []
        if request.mode == "dialogue":
            if not request.messages or not request.speakers:
                raise ValueError("Dialogue regeneration requires messages and speakers.")
            speaker_map = {speaker.id: speaker for speaker in request.speakers}
            total = len(request.messages)
            if request.index >= total:
                raise ValueError("Segment index out of range.")
            for index, message in enumerate(request.messages):
                speaker = speaker_map.get(message.speaker_id)
                if not speaker:
                    raise ValueError(f"Unknown speaker for message {index + 1}.")
                text = request.text if index == request.index else message.text
                voice = request.voice_id if index == request.index else speaker.voice_id
                speed = request.speed if index == request.index else speaker.speed
                audio = synthesize_turn(text, voice, speed, engine=engine, model_id=model_id)
                changing = index < total - 1 and request.messages[index + 1].speaker_id != message.speaker_id
                pause = (
                    request.speaker_change_pause
                    if changing
                    else (request.same_speaker_pause if index < total - 1 else 0)
                )
                segments.append((audio, pause))
        else:
            chunks = list(request.lecture_chunks or [])
            if not chunks:
                raise ValueError("Lecture regeneration requires lecture_chunks.")
            if request.index >= len(chunks):
                raise ValueError("Segment index out of range.")
            chunks[request.index] = request.text
            for index, chunk in enumerate(chunks):
                voice = request.voice_id
                speed = request.speed
                audio = synthesize_turn(chunk, voice, speed, engine=engine, model_id=model_id)
                pause = request.section_pause if index < len(chunks) - 1 else 0
                segments.append((audio, pause))

        output = unique_output_path(request.topic, "wav")
        concatenate_wavs(segments, output)
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
            model_id=model_id,
        )
        return {
            "url": url,
            "filename": output.name,
            "mp3_url": mp3_url,
            "mp3_filename": mp3_output.name,
            "history_id": history.id,
            "model_id": model_id,
            "index": request.index,
        }
    except Exception as error:  # noqa: BLE001
        raise fail(error)
