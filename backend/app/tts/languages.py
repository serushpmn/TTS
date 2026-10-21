from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SynthLanguage:
    id: str
    label: str
    lang_code: str  # Kokoro KPipeline lang_code
    onnx_lang: str  # kokoro-onnx phonemizer lang
    voice_prefixes: tuple[str, ...]
    status: str  # "supported" | "experimental" | "unavailable"
    engine: str  # "both" | "torch" | "onnx"
    notes: str


# Stock kokoro 0.9.4 ships English (+ other espeak langs). German is not in LANG_CODES;
# we expose it as experimental via optional runtime registration + espeak-ng.
SYNTH_LANGUAGES: tuple[SynthLanguage, ...] = (
    SynthLanguage(
        id="en-us",
        label="English (US)",
        lang_code="a",
        onnx_lang="en-us",
        voice_prefixes=("af_", "am_"),
        status="supported",
        engine="both",
        notes="American English voices and G2P.",
    ),
    SynthLanguage(
        id="en-gb",
        label="English (UK)",
        lang_code="b",
        onnx_lang="en-gb",
        voice_prefixes=("bf_", "bm_"),
        status="supported",
        engine="both",
        notes="British English voices and G2P.",
    ),
    SynthLanguage(
        id="de",
        label="German",
        lang_code="d",
        onnx_lang="en-us",  # ONNX path has no German phonemizer in kokoro-onnx
        voice_prefixes=("af_", "am_", "bf_", "bm_"),
        status="experimental",
        engine="torch",
        notes=(
            "Experimental: uses espeak-ng German phonemes with the English Kokoro checkpoint "
            "and installed English voice packs. Quality varies. ONNX engine does not support German — use PyTorch."
        ),
    ),
    SynthLanguage(
        id="es",
        label="Spanish",
        lang_code="e",
        onnx_lang="en-us",
        voice_prefixes=("af_", "am_", "bf_", "bm_"),
        status="experimental",
        engine="torch",
        notes="Experimental espeak G2P with English voices (Torch only).",
    ),
    SynthLanguage(
        id="fr",
        label="French",
        lang_code="f",
        onnx_lang="en-us",
        voice_prefixes=("af_", "am_", "bf_", "bm_"),
        status="experimental",
        engine="torch",
        notes="Experimental espeak G2P with English voices (Torch only).",
    ),
    SynthLanguage(
        id="it",
        label="Italian",
        lang_code="i",
        onnx_lang="en-us",
        voice_prefixes=("af_", "am_", "bf_", "bm_"),
        status="experimental",
        engine="torch",
        notes="Experimental espeak G2P with English voices (Torch only).",
    ),
)


DEFAULT_SYNTH_LANG = "en-us"


def get_language(lang_id: str | None) -> SynthLanguage:
    if not lang_id or lang_id in ("auto",):
        return SYNTH_LANGUAGES[0]
    for item in SYNTH_LANGUAGES:
        if item.id == lang_id:
            return item
    raise ValueError(f"Unknown synthesis language '{lang_id}'.")


def list_languages() -> list[dict]:
    auto = {
        "id": "auto",
        "label": "Auto (from voice)",
        "lang_code": "",
        "status": "supported",
        "engine": "both",
        "notes": "Infer English US/UK from the selected voice id prefix.",
        "voice_prefixes": [],
    }
    return [auto] + [
        {
            "id": item.id,
            "label": item.label,
            "lang_code": item.lang_code,
            "status": item.status,
            "engine": item.engine,
            "notes": item.notes,
            "voice_prefixes": list(item.voice_prefixes),
        }
        for item in SYNTH_LANGUAGES
    ]


def ensure_lang_registered(lang_code: str) -> None:
    """Register German (and aliases) on stock Kokoro if missing."""
    try:
        from kokoro import pipeline as kp
    except ImportError:
        return
    if lang_code == "d":
        kp.ALIASES.setdefault("de", "d")
        kp.ALIASES.setdefault("de-de", "d")
        if "d" not in kp.LANG_CODES:
            kp.LANG_CODES["d"] = "de"


def resolve_lang_for_voice(voice_id: str, synth_lang: str | None) -> SynthLanguage:
    if synth_lang in (None, "", "auto"):
        if voice_id.startswith(("bf_", "bm_")):
            return get_language("en-gb")
        return get_language("en-us")
    return get_language(synth_lang)
