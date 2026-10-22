# HTTP API

Base URL for the UI: `VITE_API_URL` or `http://localhost:8000`. JSON `Content-Type: application/json`. Errors: FastAPI `{ "detail": ... }` (string or validation list). Domain failures from `fail()` are **400**.

Job objects include legacy `status` (`queued`/`running`/`done`/`error`/`cancelled`) plus `status_detail` (`pending`, `initializing_model`, `generating`, `combining`, `exporting`, `completed`, `failed`, `cancelled`). See `services/jobs.py`.

## Static (not under `/api`)

| Mount | Directory |
|-------|-----------|
| `/audio` | `output/` |
| `/preview` | `temp/` |
| `/voice-samples` | `data/voice_samples/` |
| `/tone-samples` | `data/tone_samples/` |

## Health and catalog

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | engine label, device, loaded engine, offline_ready, selected_model_id |
| GET | `/api/status/offline` | `model_manager.offline_status()` |
| GET | `/api/voices` | Kokoro voice list |
| GET | `/api/voices/samples` | bake status |
| POST | `/api/voices/{voice_id}/sample?force=` | bake one sample |
| POST | `/api/voices/samples/ensure-all?force=` | bake all (sequential worker) |
| GET | `/api/tones` | tones + `sample_url` |
| POST | `/api/tones/{tone_id}/sample?force=&voice_id=` | bake tone clip |
| GET | `/api/languages` | synth languages |

## Pronunciation

| Method | Path | Body |
|--------|------|------|
| GET | `/api/pronunciation` | — |
| PUT | `/api/pronunciation` | `{ "entries": { word: replacement } }` |
| POST | `/api/pronunciation` | `{ "word", "pronunciation" }` |
| DELETE | `/api/pronunciation/{word}` | — |

## Prefs and models

| Method | Path | Notes |
|--------|------|--------|
| GET/PUT | `/api/prefs` | PUT `PrefsUpdate` (all fields optional) |
| GET | `/api/models` | variants + install state |
| POST | `/api/models/{model_id}/select` | persist selection |
| POST | `/api/models/{model_id}/download` | background download job |
| POST | `/api/models/{model_id}/load` | select + `engine_hub.get` |
| DELETE | `/api/models/{model_id}` | unload if current, delete files |
| POST | `/api/models/unload` | unload engine |
| POST | `/api/models/voices/download` | voice pack job |
| GET | `/api/models/downloads/{job_id}` | |
| POST | `/api/models/downloads/{job_id}/cancel` | |

Declare `/api/models/voices/download` **before** `{model_id}` routes.

## Parse, preview, generate

| Method | Path | Body / result |
|--------|------|----------------|
| POST | `/api/parse` | `{ "text" }` → `{ speaker_name, text }[]` |
| POST | `/api/preview` | `PreviewRequest` → `{ "url": "/preview/..." }` |
| POST | `/api/generate` | `ConversationRequest` → job dict; thread `run_generation` |
| GET | `/api/generate/{job_id}` | job |
| POST | `/api/generate/{job_id}/cancel` | |
| POST | `/api/lecture/plan` | `{ text, speed?, section_pause? }` → `LecturePlan` |
| POST | `/api/lecture` | `LectureRequest` → job; thread `run_lecture` |
| POST | `/api/segments/regenerate` | `SegmentRegenRequest` → new urls + `history_id` (sync) |
| GET | `/api/audio/{filename}/local-path` | `{ path, filename }` if file is in `output/` |

`ConversationRequest` / `LectureRequest` / `SegmentRegenRequest` fields: `docs/database.md` (same Pydantic models in `schemas.py`). Preview/generate/lecture/regen reject incompatible model×`synth_lang`.

## Projects, history, benchmark

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/projects` | |
| GET | `/api/projects/{id}` | 404 if missing |
| PUT | `/api/projects/{id}` | body `Project`; id must match URL |
| POST | `/api/projects/{id}/duplicate` | optional `{ "name" }` |
| DELETE | `/api/projects/{id}` | `{ status, id }` |
| GET | `/api/history` | newest first |
| DELETE | `/api/history/{item_id}` | removes JSON row and files |
| GET | `/api/benchmarks` | |
| POST | `/api/benchmarks` | `BenchmarkRequest`; runs in 1-worker pool; returns result |

There is **no** `POST /api/projects` create-empty; the UI `PUT`s a client-generated id.
