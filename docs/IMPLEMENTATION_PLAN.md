# Dialogue Studio — Implementation Plan

Actionable tasks with acceptance criteria. Status reflects work completed in this pass.

## Stage A — Audit & baseline

- [x] Inspect repo structure, README vs code, TTS stack
- [x] Record baseline: initially `12 passed`; now `23 passed` pytest
- [x] Write `docs/PROJECT_AUDIT.md`

**Acceptance:** Audit matches verified code; baseline recorded.

---

## Stage B — Backend TTS abstraction + ONNX models

### B1. Engine protocol
- [x] `TTSEngine` protocol + Torch / ONNX implementations
- [x] Factory with lock: one loaded inference backend at a time

**Acceptance:** Dialogue/lecture generation works with Torch and with installed ONNX.

### B2. Model registry
- [x] Eight ONNX variants + `kokoro-torch` metadata
- [x] Default preference remains `kokoro-torch` until user selects/downloads ONNX
- [x] Recommended ONNX: `model_q8f16` (verified load + preview on Windows CPU)

### B3. Model manager
- [x] List / download (progress + cancel) / size + SHA-256 when known / delete
- [x] Resume-safe `.partial` downloads
- [x] Shared voice pack download
- [x] Load/unload; failed load does not leave corrupt prefs
- [x] Persist selected model in `data/prefs.json`
- [x] No auto-download of all eight; no silent substitution

### B4. ONNX engine
- [x] `kokoro-onnx` + safe ORT session (`ORT_DISABLE_ALL` — required on ORT 1.31/Windows)
- [x] Cache keys include `model_id`
- [x] Generate/preview/lecture honor selected model

**Acceptance:** Verified `model_q8f16` preview + benchmark on this machine.

---

## Stage C — API / jobs / persistence

- [x] Routers under `app/api/`
- [x] Richer job stages + cancel cleanup of in-progress exports
- [x] Atomic JSON writes
- [x] Expanded project schema + duplicate API
- [x] Offline/assets status endpoint
- [x] Input length limits on schemas

---

## Stage D — Benchmarking

- [x] Same text/voice/settings; measured timings only
- [x] Persist under `data/benchmarks/`
- [x] UI button in Models panel
- [x] Sample listening URLs optional

**Measured on audit machine (2026-10-21):** see audit final section.

---

## Stage E — Segment / audio

- [x] Segment regenerate API + dialogue UI (↻)
- [x] Configurable same-speaker / speaker-change / section pauses
- [x] Expression-tag help clarifies approximations

---

## Stage F — Frontend

- [x] Extract Icons, AudioPlayer, ModelPanel, ProjectsPanel
- [x] Model + Projects drawers
- [x] Audio player with duration + independent playback rate
- [x] Production `npm run build` succeeds

---

## Stage G — Tests & docs

- [x] Expanded backend tests (registry, manager, prefs, jobs)
- [x] README + audit + this plan updated
- [x] Smoke scripts for download / ONNX preview / benchmark

**Acceptance:** pytest green; documented commands verified on Windows.
