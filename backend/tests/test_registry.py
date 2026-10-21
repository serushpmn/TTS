from __future__ import annotations

from app.tts.registry import (
    DEFAULT_ONNX_MODEL_ID,
    ONNX_VARIANTS,
    TORCH_ENGINE_ID,
    get_variant,
    require_variant,
)


def test_eight_onnx_variants():
    assert len(ONNX_VARIANTS) == 8
    ids = {item.id for item in ONNX_VARIANTS}
    assert "model_q8f16" in ids
    assert "model" in ids


def test_recommended_default_onnx():
    recommended = [item for item in ONNX_VARIANTS if item.recommended]
    assert len(recommended) == 1
    assert recommended[0].id == DEFAULT_ONNX_MODEL_ID


def test_require_variant():
    assert require_variant(TORCH_ENGINE_ID).runtime == "torch"
    assert require_variant("model_q8f16").filename == "model_q8f16.onnx"
    assert get_variant("nope") is None
