# Dialogue Studio — agent guide

Local **multi-speaker dialogue and lecture TTS**. React UI talks to a FastAPI backend that runs **Kokoro** (PyTorch and/or ONNX). No cloud API keys. No SQL database. No auth.

Read this first, then open only the `docs/` file you need.

## Tech stack

| Layer | Stack |
|-------|--------|
| UI | Vite 8, React, TypeScript — `frontend/` |
| API | FastAPI + uvicorn — `backend/app/main.py` |
| TTS | `kokoro` (Torch) and `kokoro-onnx` + `onnxruntime` (CPU, graph opts **disabled**) |
| Audio | WAV concatenate/trim, MP3 via `lameenc` |
| Persistence | JSON files under `data/` (see `docs/database.md`) |

Python **3.10–3.12** only (3.12 recommended). Node **20+**.

## Folder structure

```text
TTS/
├── AGENTS.md, README.md, Design.md
├── docs/                 # architecture, api, database, status, roadmap
├── scripts/              # setup.mjs, dev.mjs (spawn-safe on paths with spaces)
├── Setup.bat / Start.bat
├── backend/app/          # FastAPI app
│   ├── main.py           # CORS, static mounts, routers
│   ├── config.py         # Settings + backend/.env
│   ├── api/              # HTTP routes
│   ├── models/schemas.py # Pydantic request/response
│   ├── services/         # jobs, generation, prefs, history, …
│   ├── audio/            # concatenate, trim, mp3, tempfiles
│   └── tts/              # engines, registry, model_manager, voices
├── backend/tests/, backend/scripts/
├── frontend/src/         # App.tsx (state) + components + helpers
├── output/  temp/  data/ # generated audio, caches, JSON + model files
```

## Key commands

```bash
npm run setup          # venv + pip + frontend npm install
npm run dev            # uvicorn :8000 + Vite :5173 (also npm start)
# Windows: Setup.bat / Start.bat

cd backend && .venv/Scripts/python.exe -m pytest    # Windows
cd frontend && npm run build
```

Health: `GET http://127.0.0.1:8000/api/health`. UI: `http://127.0.0.1:5173`.

Smoke scripts (network on first download): `backend/scripts/smoke_*.py` with `PYTHONPATH=backend`.

## Architecture (one paragraph)

Generate/preview/lecture start on FastAPI. Long jobs run in a **daemon thread** (`services/generation.py`) with in-memory `JobStore`. Each turn: pronunciation + tone markup → engine `synthesize` → optional silence trim → concatenate + MP3 → `data/history.json` + files in `output/`. Static mounts: `/audio`, `/preview`, `/voice-samples`, `/tone-samples`. One inference backend loaded at a time (`tts/factory.py` `EngineHub`). Details: `docs/architecture.md`. Endpoints: `docs/api.md`.

## Coding conventions

- Python: `from __future__ import annotations`; Pydantic v2 models in `schemas.py`; API errors via `app.api.deps.fail` → HTTP **400** `detail=str(error)`. JSON writes use `atomic_write_json`.
- Do **not** silently swap models (`registry.require_variant`). ONNX sessions use `ORT_DISABLE_ALL` (`tts/onnx_engine.py`).
- Windows temp WAV: `app.audio.tempfiles` (close `mkstemp` fd; retry unlink).
- Frontend: `api.ts` is the only fetch layer (`VITE_API_URL` or `http://localhost:8000`). Types in `types.ts` must stay aligned with schemas. UI copy in `i18n.ts` (en/fa/de). **UI locale ≠ speech language.**
- After user-visible changes: update `README.md` (workspace rule). Do not git-commit unless asked.

## Do not

- Do not use Python 3.13+. Do not bind API to `0.0.0.0` unless the user wants LAN exposure (`dev.mjs` hardcodes `127.0.0.1`).
- Do not claim Kokoro has native emotion; tones are speed/pause/markup only (`services/tone.py`).
- Do not merge header UI locale with Delivery **speech language**.
- Do not change `/api/*` contracts without updating `frontend/src/api.ts` **and** `docs/api.md`.
- Do not commit `.env`, `data/*.json`, `data/models/`, `data/voices/`, `output/*` audio, or secrets.
- Do not enable ONNX Runtime graph optimizations (Windows AV on some quantizations).
- Do not invent features or env vars; if unsure, write `TODO: needs confirmation`.

## Agent working rules

1. **Read before edit:** relevant source + `docs/status.md`; for HTTP, `docs/api.md`; for JSON files, `docs/database.md`; for engines, `docs/architecture.md`.
2. **After a significant architecture change or new feature:** update `docs/status.md` and any related docs (`api.md`, `database.md`, `architecture.md`, `README.md`, `docs/FEATURE_ROADMAP.md` if a roadmap ID changed).
3. Avoid drive-by refactors, unused abstractions, and formatting-only diffs.
4. Suggest a short imperative commit message; do not create the commit unless the user asks.

## Docs index

| File | When to read |
|------|----------------|
| `docs/architecture.md` | Data flow, engines, jobs |
| `docs/api.md` | HTTP + static mounts |
| `docs/database.md` | JSON “tables” and dirs |
| `docs/status.md` | Done / remaining / known bugs |
| `docs/FEATURE_ROADMAP.md` | Staged feature IDs |
| `docs/PROJECT_AUDIT.md` | Historical (2026-10-21); **ONNX section is stale** |
| `docs/IMPLEMENTATION_PLAN.md` | ONNX/engine implementation checklist |
