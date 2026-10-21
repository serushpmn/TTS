from __future__ import annotations

from pathlib import Path
from time import time

from app.audio.concatenate import concatenate_wavs
from app.audio.mp3 import wav_to_mp3
from app.models.schemas import ConversationRequest, LectureRequest
from app.services.history import add_history
from app.services.jobs import jobs
from app.services.lecture import split_lecture_text
from app.services.prefs import selected_model_id
from app.services.synthesis import synthesize_turn, unique_output_path
from app.tts.factory import engine_hub
from app.tts.model_manager import model_manager
from app.tts.registry import require_variant


def _resolve_model_id(explicit: str | None) -> str:
    model_id = explicit or selected_model_id()
    require_variant(model_id)
    return model_id


def _cleanup_outputs(paths: list[str]) -> None:
    for raw in paths:
        path = Path(raw)
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass


def run_generation(job_id: str, request: ConversationRequest) -> None:
    if not jobs.try_begin(job_id):
        jobs.update(
            job_id,
            status="failed",
            stage="Failed",
            error="Another generation job is already running.",
            finished_at=time(),
        )
        return

    speaker_map = {speaker.id: speaker for speaker in request.speakers}
    model_id = _resolve_model_id(request.model_id)
    jobs.update(job_id, status="initializing_model", stage="Loading model…", model_id=model_id, current=0)
    output_paths: list[str] = []
    try:
        if jobs.is_cancelled(job_id):
            return
        model_manager.ensure_assets_for(model_id)
        engine = engine_hub.get(model_id)
        jobs.update(job_id, status="generating", stage="Starting synthesis…")
        segments: list[tuple[Path, float]] = []
        total = len(request.messages)
        same_pause = getattr(request, "same_speaker_pause", 0.35)
        for index, message in enumerate(request.messages):
            if jobs.is_cancelled(job_id):
                _cleanup_outputs(output_paths)
                return
            speaker = speaker_map.get(message.speaker_id)
            if not speaker:
                raise ValueError(f"Message {index + 1} references an unknown speaker.")
            jobs.update(
                job_id,
                stage=f"Synthesizing turn {index + 1} of {total} ({speaker.name})",
                current=index,
            )
            segment = synthesize_turn(message.text, speaker.voice_id, speaker.speed, engine=engine, model_id=model_id)
            if jobs.is_cancelled(job_id):
                _cleanup_outputs(output_paths)
                return
            changing = index < total - 1 and request.messages[index + 1].speaker_id != message.speaker_id
            pause = request.speaker_change_pause if changing else (same_pause if index < total - 1 else 0)
            segments.append((segment, pause))
            jobs.update(job_id, current=index + 1)

        if jobs.is_cancelled(job_id):
            _cleanup_outputs(output_paths)
            return
        jobs.update(job_id, status="combining", stage="Combining audio…", current=total)
        output = unique_output_path(request.topic, "wav")
        concatenate_wavs(segments, output)
        output_paths.append(str(output))
        jobs.track_output(job_id, str(output))
        if jobs.is_cancelled(job_id):
            _cleanup_outputs(output_paths)
            return
        jobs.update(job_id, status="exporting", stage="Encoding MP3…")
        mp3_output = output.with_suffix(".mp3")
        wav_to_mp3(output, mp3_output)
        output_paths.append(str(mp3_output))
        jobs.track_output(job_id, str(mp3_output))
        if jobs.is_cancelled(job_id):
            _cleanup_outputs(output_paths)
            return
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
        jobs.update(
            job_id,
            status="completed",
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
    except Exception as error:  # noqa: BLE001
        if jobs.is_cancelled(job_id):
            _cleanup_outputs(output_paths)
            return
        _cleanup_outputs(output_paths)
        jobs.update(
            job_id,
            status="failed",
            stage="Failed",
            error=str(error),
            eta_seconds=None,
            finished_at=time(),
        )
    finally:
        jobs.end(job_id)


def run_lecture(job_id: str, request: LectureRequest) -> None:
    if not jobs.try_begin(job_id):
        jobs.update(
            job_id,
            status="failed",
            stage="Failed",
            error="Another generation job is already running.",
            finished_at=time(),
        )
        return

    model_id = _resolve_model_id(request.model_id)
    output_paths: list[str] = []
    try:
        chunks = split_lecture_text(request.text)
    except ValueError as error:
        jobs.update(job_id, status="failed", stage="Failed", error=str(error), finished_at=time())
        jobs.end(job_id)
        return

    total = len(chunks)
    jobs.update(
        job_id,
        status="initializing_model",
        stage="Loading model…",
        current=0,
        total=total,
        model_id=model_id,
    )
    try:
        if jobs.is_cancelled(job_id):
            return
        model_manager.ensure_assets_for(model_id)
        engine = engine_hub.get(model_id)
        jobs.update(job_id, status="generating", stage="Starting lecture…", total=total)
        segments: list[tuple[Path, float]] = []
        for index, chunk in enumerate(chunks):
            if jobs.is_cancelled(job_id):
                _cleanup_outputs(output_paths)
                return
            jobs.update(
                job_id,
                stage=f"Narrating section {index + 1} of {total}",
                current=index,
                total=total,
            )
            segment = synthesize_turn(chunk, request.voice_id, request.speed, engine=engine, model_id=model_id)
            if jobs.is_cancelled(job_id):
                _cleanup_outputs(output_paths)
                return
            pause = request.section_pause if index < total - 1 else 0
            segments.append((segment, pause))
            jobs.update(job_id, current=index + 1, total=total)

        if jobs.is_cancelled(job_id):
            _cleanup_outputs(output_paths)
            return
        jobs.update(job_id, status="combining", stage="Combining audio…", current=total, total=total)
        output = unique_output_path(request.topic, "wav")
        concatenate_wavs(segments, output)
        output_paths.append(str(output))
        if jobs.is_cancelled(job_id):
            _cleanup_outputs(output_paths)
            return
        jobs.update(job_id, status="exporting", stage="Encoding MP3…")
        mp3_output = output.with_suffix(".mp3")
        wav_to_mp3(output, mp3_output)
        output_paths.append(str(mp3_output))
        if jobs.is_cancelled(job_id):
            _cleanup_outputs(output_paths)
            return
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
        jobs.update(
            job_id,
            status="completed",
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
    except Exception as error:  # noqa: BLE001
        if jobs.is_cancelled(job_id):
            _cleanup_outputs(output_paths)
            return
        _cleanup_outputs(output_paths)
        jobs.update(
            job_id,
            status="failed",
            stage="Failed",
            error=str(error),
            eta_seconds=None,
            finished_at=time(),
        )
    finally:
        jobs.end(job_id)
