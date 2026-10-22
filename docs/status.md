# Status

Last verified from source while writing agent docs (2026-10-22). Feature IDs: `docs/FEATURE_ROADMAP.md`. Older narrative: `docs/IMPLEMENTATION_PLAN.md`. **`docs/PROJECT_AUDIT.md` (2026-10-21) is stale** where it says ONNX is unused — ONNX is implemented.

## Shipped

- Dialogue + lecture generation; WAV + MP3; history; projects; prefs.
- Torch engine (`kokoro-torch`) and selectable ONNX variants; download/load/delete; voice pack; no silent model fallback.
- Pause presets, trim silence, pronunciation dict, tone chips (speed/pause only) + tone samples.
- Synth languages: `en-us`, `en-gb`; experimental `de`/`es`/`fr`/`it` on Torch; ONNX English-only guard on preview/generate/lecture/regen.
- UI i18n EN/FA/DE (RTL for FA). Header = UI locale; Delivery = speech language.
- `strict_cast`, preview with tone/lang, export basename + copy path/URL, project profiles, smarter import, line regen UX.
- Studio chrome: 3-region layout, Settings `⋯`, compact speakers, composer icons, custom player, generate orb animation, draft toast.
- Windows temp WAV: close `mkstemp` handle + retry unlink (`WinError 32` on `trim-*.wav`).

Roadmap **stages 1–7: done**. Stage **8 pending:** honest-tone-copy polish, real non-English voices, batch queue.

## Known limitations (code, not guesses)

- Kokoro has **no native emotion**; UI tones are markup/speed.
- Experimental non-English uses English checkpoints + espeak; quality varies; ONNX path does not support those langs.
- Generation jobs are **in-memory**; restart loses progress.
- `scripts/dev.mjs` always binds `127.0.0.1:8000` / `:5173` even if `API_HOST`/`API_PORT` are set in `.env`.
- Several `Settings` env fields are loaded but **not referenced** outside `config.py` (see `TODO` below).
- Frontend is largely `App.tsx` (~1900 lines); layout shells were not extracted into separate files (Toast/AudioPlayer/panels exist).
- `data/tone_samples/` is not in `.gitignore` (voice_samples is).

## Known bugs / fixes

| Item | State |
|------|--------|
| `WinError 32` deleting `trim-*.wav` | Addressed in `audio/tempfiles.py` + concatenate/synthesis. Restart backend if an old process still holds a file. |
| ONNX crash with default ORT opts | Mitigated: `ORT_DISABLE_ALL`. |
| Paths with spaces on Windows npm scripts | Mitigated: `scripts/*.mjs` spawn without broken quoting. |

## How to verify

```bash
# backend (from repo; PYTHONPATH=backend if needed)
backend/.venv/Scripts/python.exe -m pytest backend/tests
cd frontend && npm run build
```

Pytest collection requires the `app` package (`cd backend` or `PYTHONPATH=backend`).
