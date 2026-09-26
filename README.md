# Dialogue Studio

A free, private local web app for turning English multi-speaker dialogue into one natural-sounding WAV file. It uses [Kokoro-82M](https://github.com/hexgrad/kokoro) locally—no API key, cloud account, or paid service.

Kokoro's Apache-2.0 model weights are downloaded once by the official package on first synthesis, then reused from its local Hugging Face cache. The app produces each turn separately, caches identical turn/voice/speed combinations, adds a configurable pause only on speaker changes, and combines PCM WAV files without requiring FFmpeg.

## Requirements

- **Python 3.10–3.12** (Python 3.11 recommended; Python 3.14 is currently too new for a dependable PyTorch/Kokoro install)
- Node.js 20+ and npm. On Windows where PowerShell blocks `npm.ps1`, use `npm.cmd`.
- Internet only for the initial model and voice-pack download; subsequent generation is offline.
- About 1 GB free disk space for Python packages and Kokoro model/cache.

GPU is optional. Kokoro runs on CPU on a normal modern computer. Install a CUDA-enabled PyTorch wheel before installing `requirements.txt` if you want PyTorch GPU acceleration; the app remains CPU-safe if CUDA is absent.

## Install and run

### Easiest (Windows)

1. One-time setup: double-click **`Setup.bat`** (or run `npm run setup`).
2. Every time after that: double-click **`Start.bat`**, or from the project folder:

```powershell
npm run dev
```

That starts the API + UI together and opens `http://localhost:5173`. Press `Ctrl+C` in that terminal to stop both.

### Manual (two terminals)

Use **Python 3.12** (or 3.10/3.11). Do not use the default `python` / `pip` if they point at 3.14 — Kokoro needs `<3.13`.

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Calling the venv `python.exe` directly avoids PowerShell’s script execution policy (which often blocks `Activate.ps1`). If you prefer activation anyway:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

In another terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the URL Vite prints (normally `http://localhost:5173`). On the first preview or generation, Kokoro downloads its `hexgrad/Kokoro-82M` model and the selected voice pack. Leave the process connected to the internet until that succeeds. Thereafter the saved cache supports offline use.

## Use

1. Add speakers and choose their persistent Kokoro voices in the right sidebar.
2. Write turns in the conversation cards, or paste `Speaker: dialogue` lines into **Import conversation**. New imported names are added visibly with the default voice so you can deliberately choose an appropriate voice.
3. Preview a card or a speaker. Identical previews use the cached WAV.
4. Set the speaker-change pause (default 2.5 seconds), then generate. The final player offers a single WAV download.
5. Save the project to `data/projects.json` locally, then reload or delete it later from **Saved projects** in the sidebar.

## Voices

The UI uses official English Kokoro IDs: American female (`af_heart`, `af_bella`, `af_nicole`, `af_sarah`, `af_sky`, `af_aoede`, `af_kore`, `af_jessica`, `af_river`, `af_alloy`, `af_nova`), American male (`am_michael`, `am_adam`, `am_eric`, `am_liam`, `am_onyx`, `am_echo`, `am_fenrir`, `am_puck`), British female (`bf_alice`, `bf_emma`, `bf_isabella`, `bf_lily`), and British male (`bm_daniel`, `bm_george`, `bm_lewis`). The backend validates IDs before calling Kokoro.

## Configuration

Copy `backend/.env.example` to your shell environment or `.env` loader of choice. The important values are `DEFAULT_VOICE`, `DEFAULT_SPEED`, `SPEAKER_CHANGE_PAUSE`, `OUTPUT_FORMAT`, and `KOKORO_DEVICE`. Defaults live centrally in `backend/app/config.py`.

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

The tests cover conversation parsing, WAV pause concatenation, and project storage. For a full manual smoke test, use Sarah / `af_heart` and John / `am_michael`, create alternating one-word turns, generate the conversation, and confirm each speaker change has the selected pause.

## Troubleshooting

- **`py -3.11` fails / No suitable Python runtime:** this machine may only have 3.12 or 3.14. Use `py -3.12 -m venv .venv`. Never install with system Python 3.14 — Kokoro requires Python &lt; 3.13.
- **`Activate.ps1` blocked by execution policy:** skip activation and call `.\.venv\Scripts\python.exe -m …` instead, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- **`kokoro` install fails / uvicorn not found:** you installed into the wrong Python. Recreate the 3.12 venv and install with `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`.
- **Kokoro is not installed:** rerun `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`.
- **First generation fails:** check internet access and sufficient disk space, then retry. The model/voice pack downloads lazily.
- **A voice fails:** pick an ID from the dropdown; IDs are validated before synthesis.
- **Browser cannot reach backend:** confirm Uvicorn is on port 8000 and Vite is on port 5173.
- **Need MP3:** WAV is intentionally mandatory and dependency-free. Convert generated files with any local FFmpeg installation: `ffmpeg -i conversation.wav conversation.mp3`.

## Adding another engine

Implement the same `synthesize(text, voice_id, speed) -> Path` contract as `KokoroEngine`, register its validated voice list, and select it through the central configuration. Keep generated assets as compatible PCM WAV so the existing concatenator and UI continue to work.
"# TTS" 
