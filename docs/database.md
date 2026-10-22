# Persistence (no SQL)

There is **no** relational database. State is JSON and files under repo-root `data/`, `output/`, and `temp/` (`app.config.Settings`; `ROOT` is the repository root, not `backend/`).

Writes go through `app.services.atomic.atomic_write_json` (write `*.tmp` then `os.replace`), except in-memory jobs.

## JSON documents

| File | Module | Shape | Notes |
|------|--------|--------|------|
| `data/prefs.json` | `services/prefs.py` | Object | Defaults if missing/corrupt. Lock around R/W. |
| `data/projects.json` | `services/storage.py` | `{ [id]: Project }` | Sorted by `updated_at`. Duplicate clears `audio_url`. |
| `data/history.json` | `services/history.py` | `HistoryItem[]` | Delete also unlinks `output/` wav/mp3 names. |
| `data/pronunciation.json` | `services/pronunciation.py` | `{ word: replacement }` | Defaults include TTS, API, WAV, … if file missing. |
| `data/benchmarks/{id}.json` | `services/benchmark.py` | Benchmark payload | Created by `POST /api/benchmarks`. |

### `prefs.json` keys (defaults in `_defaults()`)

| Key | Default |
|-----|---------|
| `selected_model_id` | `kokoro-torch` (`DEFAULT_MODEL_ID`) |
| `playback_rate` | `1.0` (clamped 0.5–2.0) |
| `favorite_voices` | `[]` |
| `default_voice_id` | `af_heart` |
| `trim_silence_default` | `false` |
| `strict_cast` | `true` |
| `ui_locale` | `en` (`en`\|`fa`\|`de`) |
| `synth_lang` | `auto` |
| `default_tone_id` | `neutral` |

Unknown extra keys in a prefs PATCH are stored as-is (`save_prefs` copies remaining keys).

### `Project` (Pydantic / `projects.json` values)

`id`, `name`, `topic`, `mode` (`dialogue`\|`lecture`), `messages[]`, `speakers[]`, pause fields, `trim_silence`, `tone_id`, `synth_lang`, `lecture_text`, narrator fields, `model_id`, `audio_url`, `created_at`, `updated_at`.

`Message`: `id`, `speaker_id`, `text`, optional `tone_id`.  
`Speaker`: `id`, `name`, `voice_id`, `speed` (0.5–2.0).

### `HistoryItem`

`id`, `topic`, `filename`, `url`, optional `mp3_*`, `messages` (count), `model_id`, `created_at` (UTC ISO).

## Directories

| Path | Role |
|------|------|
| `data/models/` | Downloaded ONNX graphs |
| `data/voices/` | Shared `voices-v1.0.bin` |
| `data/voice_samples/` | Baked voice previews (`/voice-samples`) |
| `data/tone_samples/` | Baked tone clips (`/tone-samples`) |
| `data/benchmarks/` | Benchmark JSON |
| `output/` | Final WAV/MP3 (`/audio`) |
| `temp/` | Preview/cache WAVs (`/preview`), silence stubs, turn caches |

Jobs (`services/jobs.py`) are **in-memory only**; they do not survive process restart.

Browser-only: draft, rail collapse, delivery collapse, theme — `localStorage` (`draft.ts`, `App.tsx`, `themes.ts`). Not on the server.

`.gitignore` ignores `data/*.json`, `data/models/`, `data/voices/`, `data/benchmarks/`, `data/voice_samples/`, `output/*` (keeps `.gitkeep`), `temp/*`. `data/tone_samples/` is **not** listed in `.gitignore` (TODO: needs confirmation whether that is intentional).
