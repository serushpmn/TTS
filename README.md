# Dialogue Studio

Local multi-speaker dialogue TTS in your browser.  
Write a conversation → generate one audio file (WAV + MP3) → download.

Powered by [Kokoro-82M](https://github.com/hexgrad/kokoro).  
**No API key. No cloud account. No paid service.** Everything runs on your machine.

---

## Quick start

### 1. Requirements

| Tool | Version | Notes |
|------|---------|--------|
| **Python** | **3.10–3.12** | **3.12 recommended.** Python 3.13/3.14 will not work with Kokoro. |
| **Node.js** | 20+ | Includes `npm` |
| **Disk** | ~1 GB | Packages + first model download |
| **Internet** | First run only | Model/voice packs download once, then work offline |

GPU is optional. CPU is fine.

### 2. Clone

```bash
git clone https://github.com/YOUR_USERNAME/TTS.git
cd TTS
```

### 3. One-time setup

```bash
npm run setup
```

This creates `backend/.venv`, installs Python deps, and installs the frontend packages.

**Windows alternative:** double-click `Setup.bat`.

### 4. Run the app

```bash
npm run dev
```

That starts:

- Backend API → `http://localhost:8000`
- Frontend UI → `http://localhost:5173` (opens in your browser)

Stop both with `Ctrl+C`.

**Windows alternative:** double-click `Start.bat`.

---

## How to use

1. Enter a **topic** (becomes the output filename).
2. Set **speakers** and voices (must mix female + male).
3. Type the chat, or import `Speaker: line` text with the import icon.
4. Optional tags in dialogue: `[pause]`, `[pause:1.5s]`, `[laugh]`, `[sigh]`, …
5. Click **Generate**.
6. Download **WAV** and/or **MP3**. Reopen older exports from History.

Header icons:

| Icon | Action |
|------|--------|
| ☾ / ☀ | Night / day |
| ◈ | Cycle theme |
| ? | Expression guide |
| ↧ | Import conversation |
| ≡ | History |
| ↺ | Reset workspace |

---

## Manual setup (if you prefer)

### Backend

```bash
cd backend
# Windows:
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# macOS / Linux:
python3.12 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

### Frontend (second terminal)

```bash
cd frontend
npm install
npm run dev
```

> On Windows PowerShell, if `npm` is blocked, use `npm.cmd` instead.

---

## Features

- Multi-speaker chat UI (left / right bubbles)
- Random voices with **required female + male mix**
- Progress bar + ETA while generating
- WAV **and** MP3 export (no FFmpeg required)
- Local history (open / download / delete)
- Day / night + theme packs
- Expression tags: pause, laugh, sigh, breath, …

---

## Voices

Official English Kokoro IDs:

- **American female:** `af_heart`, `af_bella`, `af_nicole`, `af_sarah`, `af_sky`, `af_aoede`, `af_kore`, `af_jessica`, `af_river`, `af_alloy`, `af_nova`
- **American male:** `am_michael`, `am_adam`, `am_eric`, `am_liam`, `am_onyx`, `am_echo`, `am_fenrir`, `am_puck`
- **British female:** `bf_alice`, `bf_emma`, `bf_isabella`, `bf_lily`
- **British male:** `bm_daniel`, `bm_george`, `bm_lewis`

---

## Configuration (optional)

Copy `backend/.env.example` to `backend/.env`:

```env
DEFAULT_VOICE=af_heart
DEFAULT_SPEED=1.0
SPEAKER_CHANGE_PAUSE=2.5
KOKORO_DEVICE=auto
```

`KOKORO_DEVICE=auto` lets PyTorch pick CPU/GPU. You can set `cpu` or `cuda` explicitly.

---

## Project layout

```text
TTS/
├── Start.bat / Setup.bat   # Windows one-click helpers
├── package.json            # npm run setup | npm run dev
├── scripts/                # setup + dev launchers
├── backend/                # FastAPI + Kokoro
├── frontend/               # Vite + React UI
├── output/                 # generated audio
├── temp/                   # cache / previews
└── data/                   # local history JSON
```

---

## Tests

```bash
cd backend
# Windows
.\.venv\Scripts\python.exe -m pytest
# macOS / Linux
./.venv/bin/python -m pytest
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `py -3.11` / wrong Python | Use **3.12**: `py -3.12 -m venv .venv` |
| Kokoro install fails on 3.13/3.14 | Recreate the venv with Python **≤ 3.12** |
| `Activate.ps1` blocked | Don’t activate — call `.\.venv\Scripts\python.exe -m …` |
| `uvicorn` / `kokoro` not found | You installed into system Python. Rerun `npm run setup` |
| First generate fails | Stay online until the model/voice pack finishes downloading |
| UI can’t reach API | Backend must be on **8000**, frontend on **5173** |
| Slow on CPU | Normal for first load; later turns reuse cache |

---

## License notes

- This app’s project code: use / modify as you like for personal and local projects.
- Kokoro model weights: [Apache-2.0](https://github.com/hexgrad/kokoro) (see upstream for details).

---

## Acknowledgements

- [hexgrad/kokoro](https://github.com/hexgrad/kokoro) — TTS engine
- FastAPI, Vite, React, lameenc
