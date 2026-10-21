# Dialogue Studio — Project Audit

**Audit date:** 2026-10-21  
**Codebase root:** `D:\Cursor Projects\TTS`  
**Baseline tests:** `12 passed` (`pytest`, backend)  
**Verified runtime:** Python 3.12.10, `kokoro==0.9.4`, `torch==2.14.0+cpu`

This document reflects the **actual source code** inspected before refactoring. Intended or README-only behavior is called out explicitly.

---

## 1. Current architecture and data flow

```text
Browser (Vite/React :5173)
    │  fetch JSON
    ▼
FastAPI (uvicorn :8000)  ← app/main.py (routes + job runners)
    │
    ├─ parse / preview / generate / lecture / history / projects
    │
    ▼
services/synthesis.py  → markup.parse_markup → KokoroEngine.synthesize
    │                         │
    │                         └─ silence WAVs for [pause]
    ▼
temp/*.wav (SHA-256 cache by text|voice|speed)
    │
    ▼
audio/concatenate.py → output/*.wav → audio/mp3.py (lameenc) → output/*.mp3
    │
    ▼
services/history.py → data/history.json
```

**Inference engine (verified):** Python **`kokoro.KPipeline`** (PyTorch).  
**Not used today:** ONNX Runtime, selectable ONNX quantizations, `kokoro-onnx`.

Pipelines are cached per language code (`a` American / `b` British) under a process-wide `Lock`. First synthesis downloads voice packs from Hugging Face (via Kokoro) when online.

**Startup:** `npm run setup` / `Setup.bat` → venv + pip + frontend install.  
`npm run dev` / `Start.bat` → uvicorn + Vite on `127.0.0.1`.

---

## 2. Feature inventory

| Feature | Status | Notes |
|--------|--------|-------|
| Multi-speaker dialogue UI | **Implemented** | Bubble chat, reorder, import `Speaker: line` |
| Lecture mode + auto-split | **Implemented** | Blank-line / sentence / word wrap (`lecture.py`) |
| Expression tags `[pause]`, `[laugh]`, etc. | **Partial** | Parsed; laugh/sigh ≈ phoneme strings (`ha ha ha`, `sigh`), not realistic FX |
| Configurable speaker-change pause | **Implemented** | UI + API `speaker_change_pause` (1–4s) |
| Section pause (lecture) | **Implemented** | |
| Voice preview | **Implemented** | `/api/preview` → temp WAV |
| WAV + MP3 export | **Implemented** | lameenc, no FFmpeg |
| Generation jobs + progress + cancel | **Implemented** | In-memory `JobStore`; cancel ignored after terminal status |
| Segment audio cache | **Partial** | Cache key omits model / markup-combined identity nuances |
| Local history (list/open/delete) | **Implemented** | Deletes WAV/MP3 from `output/` |
| Project persistence API | **Partial** | Backend CRUD exists; **frontend never calls save/list/delete** — only `localStorage` draft |
| Day/night theme | **Implemented** | |
| Mixed female+male voice rule | **Implemented** | Dialogue-only frontend rule |
| ONNX model selection (8 variants) | **Missing** | Torch pipeline only |
| Model download manager | **Missing** | Lazy HF download buried inside Kokoro |
| Model benchmarking | **Missing** | |
| Per-sentence regenerate / segment metadata | **Missing** | Full job only |
| Per-line speed (beyond speaker + `[slow]`/`[fast]`) | **Partial** | Speaker speed + markup speed markers |
| Pronunciation dictionary | **Missing** | |
| Offline readiness indicator | **Missing** | Works offline after assets download, but no status API |
| Frontend component modularity | **Partial** | Single `App.tsx` ~1259 lines |
| Bind localhost only | **Implemented** | uvicorn default; Vite `--host 127.0.0.1` |
| CORS locked to Vite origin | **Implemented** | `http://localhost:5173` |
| Automated CI | **Missing** | No GitHub Actions |
| Frontend tests | **Missing** | |

---

## 3. Critical bugs and reliability issues

1. **Cancelled jobs can leave orphaned outputs / history**  
   Concatenation and `add_history` can complete before the final cancel check; cancel does not delete partial exports.

2. **Effect tags documented as expressive audio**  
   `[laugh]` / `[sigh]` synthesize approximate words via TTS — easy to over-claim quality.

3. **Projects API dead on frontend**  
   Users cannot rename/duplicate/reopen server-side projects; draft is browser-local only.

4. **Global singleton engine in `main.py`**  
   Tight coupling; hard to swap engines or reload models safely.

5. **Cache key incomplete for future multi-model**  
   `text|voice|speed` only — will incorrectly reuse audio across models once ONNX variants exist.

6. **No input size caps**  
   Extremely long lecture text can exhaust memory/CPU with no guardrails.

7. **Import of speakers defaults new voices to `af_heart`**  
   Can temporarily violate mixed-gender rule until user fixes voices.

8. **History / static mounts**  
   `/audio` and `/preview` expose directory listings of generated files on localhost (acceptable for local app; document clearly).

9. **Non-atomic JSON writes**  
   `history.json` / `projects.json` written with plain `write_text` — crash mid-write can corrupt.

10. **ETA is heuristic**  
    Initial ETA = `total * 4.5s`; later derived from elapsed — fine, but not “precise.”

---

## 4. Performance bottlenecks

| Area | Observation |
|------|-------------|
| First inference | Torch model + voice pack download/load dominates |
| CPU synthesis | Expected slow RTF on CPU; no ONNX quantized path yet |
| Preview | Blocks request thread until synth finishes (sync route) |
| Generate | Background `Thread` — OK for local use; no worker pool |
| Frontend poll | 450ms interval — acceptable |
| Temp growth | Cache WAVs never pruned |

---

## 5. Security and privacy

| Topic | Assessment |
|-------|------------|
| Network bind | Localhost by default — good |
| CORS | Restricted to Vite origin — good |
| Path traversal on delete | `Path(name).name` used — good |
| External data | Kokoro/HF downloads on first use — must be user-initiated or clearly disclosed for ONNX manager |
| Telemetry | None found — good |
| Secrets | No API keys — good |
| Unvalidated project IDs | String IDs; file path not derived from ID for audio — OK |

---

## 6. Refactoring recommendations

### Backend
- Introduce `TTSEngine` protocol + factory; isolate Torch vs ONNX.
- Central **model registry** + **model manager** (download, verify, load/unload, prefs).
- Split FastAPI routers: `voices`, `generate`, `models`, `history`, `projects`, `benchmark`.
- Atomic JSON persistence helper.
- Segment-level job metadata + optional single-segment regenerate.
- Explicit offline/asset status endpoint.
- Keep job store in-process (sufficient for single-user local app).

### Frontend
- Split `App.tsx` into layout, dialogue editor, lecture editor, speakers, model panel, progress, player, history/projects.
- Wire projects API; keep draft as autosave backup.
- Model selector with download/load status (no silent substitution).
- Confirm destructive deletes; improve a11y labels (many icon buttons already labeled).

### Dependencies
- Add `onnxruntime` (+ optional GPU extra later).
- Prefer implementing ONNX path with `onnxruntime` + existing `misaki` phonemizer rather than forcing a full rewrite onto Torch.
- Retain Torch engine as optional fallback (`TTS_ENGINE=kokoro-torch`) so existing installs keep working.

---

## 7. Proposed target architecture

```text
app/
  main.py                 # app factory, middleware, mounts
  config.py               # settings + paths
  api/                    # routers
  models/schemas.py
  tts/
    base.py               # protocol
    voices.py
    registry.py           # 8 ONNX variants metadata
    model_manager.py      # download / verify / delete
    onnx_engine.py
    torch_engine.py       # current KPipeline wrapper
    factory.py            # process-wide loaded engine
  services/
    synthesis.py          # markup + turn synth
    jobs.py
    lecture.py / parser.py / markup.py
    history.py / storage.py / prefs.py
    benchmark.py
    segments.py           # cache keys + regenerate
  audio/
```

**Default recommended ONNX model:** `model_q8f16.onnx` (~86 MB) from  
`onnx-community/Kokoro-82M-v1.0-ONNX` (Apache-2.0), subject to local load smoke test.  
If incompatible on a given ORT build, fail clearly — **never silent substitute**.

---

## 8. Prioritized implementation plan

See `docs/IMPLEMENTATION_PLAN.md`.

| Priority | Work |
|----------|------|
| P0 | Audit docs (this file) + baseline tests recorded |
| P1 | TTS abstraction + ONNX registry/manager + selection API/UI |
| P2 | Router split, atomic storage, safer cancel cleanup, cache keys include model |
| P3 | Projects UI + prefs persistence for selected model |
| P4 | Benchmark utility |
| P5 | Segment regenerate + richer job stages |
| P6 | Frontend modularization + player/UX polish |
| P7 | Tests, README, offline status, security hardening |

---

## 9. Inference stack summary (authoritative)

| Layer | Current | Target |
|-------|---------|--------|
| Primary synth | PyTorch `kokoro.KPipeline` | ONNX Runtime + selectable quantizations |
| Phonemizer | Inside Kokoro/Misaki | Misaki (shared) |
| Voices | Kokoro HF packs | ONNX `voices/*.bin` (+ reuse where possible) |
| Fallback | n/a | Optional Torch engine via config |

---

## 10. Post-implementation status (2026-10-21)

### Refactoring delivered
- Backend split into `app/api/*`, `app/tts/*` (registry, manager, torch/onnx engines, factory), generation/benchmark services.
- Frontend: Models / Projects panels, AudioPlayer, Icons extraction; App still hosts dialogue/lecture chrome (intentional incremental split).
- Default selected engine remains **`kokoro-torch`** so existing installs keep generating without an ONNX download.
- Recommended ONNX variant **`model_q8f16`** verified (SHA-256 match + preview + benchmark).

### Tests executed
| Suite | Result |
|-------|--------|
| `pytest` (backend) | **23 passed** |
| `npm run build` (frontend) | **success** |
| ONNX voice pack download | **success** (~28 MB) |
| `model_q8f16` download + checksum | **success** (86,033,585 bytes) |
| ONNX preview smoke | **success** |
| Benchmark `kokoro-torch` vs `model_q8f16` | **measured** (see below) |

### Measured benchmark (this Windows CPU machine)
Same text `Hello from the benchmark suite.`, voice `af_heart`, speed `1.0`:

| Model | Load (s) | First gen (s) | Warm (s)* | RTF (first/audio) |
|-------|----------|---------------|-----------|-------------------|
| `kokoro-torch` | ~0† | ~20.9 | ~0 (cache) | ~4.31 |
| `model_q8f16` | ~3.68 | ~2.43 | ~0 (cache) | ~0.51 |

\*Warm hits on-disk segment cache. †Torch pipeline already warm / cheap re-get in this run.  
Do not treat these numbers as universal; re-run Benchmark in the Models panel on your hardware.

### Critical fix discovered during verification
ONNX Runtime **1.31** on Windows **access-violates** when loading Kokoro ONNX graphs with default graph optimizations. The ONNX engine now creates sessions with `ORT_DISABLE_ALL`.

### Remaining limitations
- Expression tags `[laugh]`/`[sigh]` remain phoneme approximations.
- Frontend is partially modularized (`App.tsx` still large).
- Peak memory metric requires optional `psutil` (not installed by default).
- Only `model_q8f16` ONNX file was fully smoke-tested; other variants share the same loader but were not individually timed.
- No GitHub Actions CI yet.
- Lecture per-section regenerate UI not exposed (API supports lecture mode via `/api/segments/regenerate`).
