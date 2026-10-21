from __future__ import annotations

from app.tts.languages import get_language
from app.tts.registry import get_variant


def assert_model_supports_synth_lang(model_id: str, synth_lang: str | None) -> None:
    """Raise ValueError if the selected model cannot synthesize this language."""
    if synth_lang in (None, "", "auto"):
        return
    language = get_language(synth_lang)
    variant = get_variant(model_id)
    if variant is None:
        raise ValueError(f"Unknown model '{model_id}'.")
    if language.engine == "torch" and variant.runtime != "torch":
        raise ValueError(
            f"Speech language '{language.label}' ({language.id}) requires the PyTorch engine "
            f"(kokoro-torch). Current model '{model_id}' is ONNX — switch in Models, or choose English."
        )
    if language.engine == "onnx" and variant.runtime != "onnx":
        raise ValueError(
            f"Speech language '{language.label}' is only available on the ONNX engine path."
        )
