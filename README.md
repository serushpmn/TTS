# Dialogue Studio

Local multi-speaker dialogue and lecture TTS in your browser.  
Write a conversation or lecture → generate one audio file (WAV + MP3) → download.

Powered by [Kokoro-82M](https://github.com/hexgrad/kokoro) (PyTorch) and selectable [ONNX quantizations](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX).  
**No API key. No cloud account. No paid service.** Everything runs on your machine.

---

## Quick start

### 1. Requirements

| Tool | Version | Notes |
|------|---------|--------|
| **Python** | **3.10–3.12** | **3.12 recommended.** Python 3.13/3.14 will not work with Kokoro. |
| **Node.js** | 20+ | Includes `npm` |
| **Disk** | ~1 GB+ | Packages + optional ONNX models (86–326 MB each) |
| **Internet** | First setup / downloads only | After models & voices are local, the app works offline |

GPU is optional. CPU is fine. ONNX Runtime uses CPU by default in this build.

### 2. Clone

```bash
git clone https://github.com/YOUR_USERNAME/TTS.git
cd TTS
```

### 3. One-time setup

```bash
npm run setup
```

Creates `backend/.venv`, installs Python deps (including `onnxruntime` + `kokoro-onnx`), and installs frontend packages.

**Windows:** double-click `Setup.bat`.

### 4. Run

```bash
npm run dev
```

- Backend API → `http://127.0.0.1:8000` (localhost only)
- Frontend UI → `http://127.0.0.1:5173`

**Windows:** double-click `Start.bat`.

Stop with `Ctrl+C`.

---

## How to use

### Dialogue mode
1. Choose **Dialogue**.
2. Enter a **topic** (output filename).
3. Set **speakers** and voices. By default casts must mix female + male; uncheck **Require mixed genders** to allow same-gender casts.
4. Type the chat, or **Import** `Speaker: line` text.
5. Optional **tone chips** (Calm, Excited, …) — map to speed/pause only; Kokoro has no native emotion.
6. Optional tags: `[pause]`, `[pause:1.5s]`, `[laugh]`, `[sigh]`, `[slow]`, `[fast]`…  
   Laugh/sigh are **spoken approximations**, not recorded sound effects.
7. Set **Speech language** (Auto / EN-US / EN-GB / experimental DE, ES, FR, IT). Non-English needs **PyTorch** + espeak; ONNX stays English-only.
8. Open **Models** to pick PyTorch or an ONNX variant (download on demand).
9. **Generate**, then download **WAV** / **MP3**. Use **↻** on a bubble to regenerate one line.

### Lecture mode
1. Choose **Lecture**.
2. Pick a narrator voice, tone, speech language, and section pause.
3. Paste a long script. Blank lines become sections; long paragraphs auto-split.
4. **Generate** — progress shows each section, then WAV + MP3.

### UI language
Use **EN / FA / DE** in the header. Persian (FA) switches the layout to RTL. Choice is saved in prefs.

### Header tools

| Control | Action |
|---------|--------|
| Speakers panel | Toggle left rail |
| Dialogue / Lecture | App mode |
| EN / FA / DE | UI language (speech language lives in Delivery) |
| Night / Day | Appearance |
| Import · History · Projects | Frequent tools |
| ⋯ Settings | Guide, Models, Voices, Dict, bubble theme, Reset (confirm) |
| Generate audio | Primary action (Ctrl+Enter; Esc cancels) |

**Layout:** left rail = Speakers + Delivery (profiles, tones, speech language, Advanced timing); center chat/lecture fills the viewport; right = player + WAV/MP3.

---

## Inference models

### Engines

| ID | Runtime | Notes |
|----|---------|--------|
| `kokoro-torch` | PyTorch `kokoro` | Default until you install ONNX. Voice packs download on first use. |
| `model_q8f16` (recommended ONNX) | ONNX Runtime | ~86 MB. Verified on Windows CPU with ORT graph opts disabled. |
| Other ONNX files | ONNX Runtime | Download only what you need from the Models panel. |

ONNX source: [`onnx-community/Kokoro-82M-v1.0-ONNX`](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) (Apache-2.0).  
Shared voice pack: `voices-v1.0.bin` from [kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx/releases).

| Model ID | Approx. size | Precision |
|----------|-------------:|-----------|
| `model` | 326 MB | FP32 |
| `model_q4` | 305 MB | 4-bit matmul |
| `model_uint8` | 177 MB | UINT8 / mixed |
| `model_fp16` | 163 MB | FP16 |
| `model_q4f16` | 154 MB | Q4 + FP16 |
| `model_uint8f16` | 114 MB | UINT8 + FP16 |
| `model_quantized` | 92.4 MB | INT8 |
| `model_q8f16` | 86 MB | Q8 + FP16 (**recommended ONNX**) |

The app **never silently substitutes** another model. If the selected model is missing, generation fails with a clear download/recovery path (use Models, or select `kokoro-torch`).

**Offline:** once the selected model (and ONNX voice pack, if needed) is installed, editing, synthesis, playback, export, and history work without network access.

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
API_HOST=127.0.0.1
API_PORT=8000
```

`API_HOST=127.0.0.1` keeps the API on loopback. Do not set `0.0.0.0` unless you intentionally expose the LAN.

---

## Project layout

```text
TTS/
├── Start.bat / Setup.bat
├── package.json              # npm run setup | npm run dev
├── scripts/                  # setup + dev launchers
├── docs/                     # audit, implementation plan, feature roadmap
├── backend/                  # FastAPI + Kokoro (Torch / ONNX)
├── frontend/                 # Vite + React + TypeScript
├── output/                   # generated audio
├── temp/                     # cache / previews / benchmark samples
└── data/                     # history, projects, prefs, models/, voices/
```

### Planned features (staged)

See [`docs/FEATURE_ROADMAP.md`](docs/FEATURE_ROADMAP.md).

**Shipped (roadmap stages 1–7):** pause presets; trim silence; Voices panel; pronunciation; tone chips + samples; speech language; **full UI i18n** EN/FA/DE (including drawers); optional strict cast; preview with tone/lang; engine↔language guard; export UX; project profiles; smarter import; line regen UX; **collapsible Delivery**; History/Projects search; shortcuts (Ctrl+. pause, Ctrl+click multi-tone).

**Next (stage 8):** honest non-EN voices / batch queue (long-term).

Bake all voice samples once (uses the selected model):

```bash
cd backend
$env:PYTHONPATH=(Get-Location)
.\.venv\Scripts\python.exe scripts\bake_voice_samples.py
```

Or use **Voices → Bake missing samples** in the UI.

---

## Manual setup

### Backend

```bash
cd backend
# Windows:
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# macOS / Linux:
python3.12 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

> On Windows PowerShell, if `npm` is blocked, use `npm.cmd`.

macOS/Linux paths are supported by the Node setup/dev scripts; phonemizer/`espeakng-loader` behavior may vary by OS — verify ONNX preview once after install.

---

## Tests

```bash
cd backend
# Windows
.\.venv\Scripts\python.exe -m pytest
# macOS / Linux
./.venv/bin/python -m pytest
```

Frontend production build:

```bash
cd frontend
npm run build
```

Optional smoke scripts (require network for first download):

```bash
cd backend
$env:PYTHONPATH=(Get-Location)   # PowerShell
.\.venv\Scripts\python.exe scripts\smoke_download_voices.py
.\.venv\Scripts\python.exe scripts\smoke_download_model.py model_q8f16
.\.venv\Scripts\python.exe scripts\smoke_onnx_preview.py
.\.venv\Scripts\python.exe scripts\smoke_benchmark.py
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Wrong Python | Use **3.12**: `py -3.12 -m venv .venv` |
| Kokoro fails on 3.13/3.14 | Recreate venv with Python **≤ 3.12** |
| ONNX load crashes / empty | App disables ORT graph opts; update `onnxruntime` / re-download model |
| Selected ONNX missing | Models panel → Download (and voice pack) — no silent fallback |
| UI shows **Failed to fetch** | Backend is not running. Check the terminal for startup errors, then rerun `npm run dev` (or `Start.bat`). API must answer at `http://127.0.0.1:8000/api/health`. |
| `'D:\Cursor' is not recognized` / setup or backend exits immediately | Folder path contains spaces (e.g. `Cursor Projects`). Use current `scripts/dev.mjs` / `scripts/setup.mjs` (they spawn `.exe` without broken Windows shell quoting). Pull latest scripts, then `npm run setup` / `npm run dev` again. |
| UI can’t reach API | Backend on **8000**, frontend on **5173**, both on localhost (`127.0.0.1`) |
| Slow first Torch generate | Normal; later turns reuse cache. Try ONNX `model_q8f16` |

---

## License notes

- This app’s project code: use / modify for personal and local projects.
- Kokoro / ONNX weights: [Apache-2.0](https://github.com/hexgrad/kokoro) — see upstream.

---

## Acknowledgements

- [hexgrad/kokoro](https://github.com/hexgrad/kokoro) — PyTorch TTS
- [onnx-community/Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) — ONNX variants
- [thewh1teagle/kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) — ONNX Python helper
- FastAPI, Vite, React, lameenc, ONNX Runtime
