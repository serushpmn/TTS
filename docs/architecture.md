# Architecture

## Runtime topology

```text
Browser  Vite/React  :5173
    fetch JSON (frontend/src/api.ts)
        │
        ▼
FastAPI  uvicorn  127.0.0.1:8000   app.main:app
    CORS: localhost|127.0.0.1:5173 only
    Static: /audio → output/
            /preview → temp/
            /voice-samples → data/voice_samples/
            /tone-samples → data/tone_samples/
```

`scripts/dev.mjs` starts both processes (host/port hardcoded to loopback). `backend/.env` is loaded in `app/config.py` via `setdefault` (does not override existing process env).

There is **no** reverse proxy, **no** authentication, **no** database server.

## Generate / lecture data flow

1. UI `POST /api/generate` (`ConversationRequest`) or `POST /api/lecture` (`LectureRequest`).
2. API checks `assert_model_supports_synth_lang` (ONNX is English-only; experimental DE/ES/FR/IT need Torch).
3. `jobs.create` then a daemon thread: `run_generation` or `run_lecture` (`services/generation.py`).
4. Only one generation job may `try_begin` at a time.
5. Per turn/section: `synthesize_turn` (`services/synthesis.py`):
   - tone prefix tags + speed multiplier (`services/tone.py`)
   - pronunciation dictionary (`services/pronunciation.py`)
   - markup (`[pause]`, `[laugh]`, `[slow]`, …) → speech segments + silence WAVs
   - engine `synthesize` (Torch `KPipeline` or ONNX `kokoro-onnx`)
   - optional leading/trailing silence trim (`audio/trim.py`)
6. `concatenate_wavs` + pauses (`speaker_change_pause` / `same_speaker_pause` / `section_pause`).
7. `wav_to_mp3` (`audio/mp3.py`, lameenc).
8. Files in `output/`; row in `data/history.json`.

Preview uses a 2-worker pool and writes under `temp/`, served at `/preview/{name}`.

Line regen (`POST /api/segments/regenerate`) resynthesizes one index, concatenates the full script again (no trim on concat in that path — trim is per-turn if requested), writes a new output file, appends history.

## Engines

`EngineHub` (`tts/factory.py`): at most one active backend.

| id | Runtime | Notes |
|----|---------|--------|
| `kokoro-torch` | PyTorch `kokoro.KPipeline` | Default `selected_model_id`. Voices download on first use. Device from `KOKORO_DEVICE` (`auto` → `None`). |
| ONNX variants | `OnnxKokoroEngine` | Files in `data/models/`; shared `data/voices/voices-v1.0.bin`. Session: CPU provider, **ORT graph optimizations off**. |

Registry: `tts/registry.py` (`ONNX_VARIANTS` + `TORCH_VARIANT`). Missing files do **not** fall back to another model.

Cancel: `jobs.cancel` sets `cancel_requested`; workers check `is_cancelled` and may unlink partial outputs.

## UI

Single-page app (`frontend/src/main.tsx` → `App.tsx`). No React Router.

Layout: sticky header · left Speakers/Delivery rail · center chat/lecture · right player. Locale `en|fa|de` is UI chrome; `synth_lang` is a generate field. Draft autosave: `frontend/src/draft.ts` (localStorage). Appearance: `themes.ts` + `data-mode` on `<html>`.

## Key decisions (from code)

| Decision | Why (verified) |
|----------|----------------|
| Loopback bind | `dev.mjs` and default `API_HOST=127.0.0.1`; comment in config warns against `0.0.0.0`. |
| Disable ORT graph opts | Comment in `onnx_engine.py`: Windows + ORT 1.31 AV on some Kokoro quants. |
| JSON files, not SQL | Small local store; `atomic_write_json` avoids truncated files. |
| Tone = markup/speed | `tone.py`: “Kokoro has no native emotion control.” |
| Close temp WAV handles | Windows `WinError 32` if `mkstemp` fd left open (`audio/tempfiles.py`). |
