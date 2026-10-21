from __future__ import annotations

import pytest

from app.tts.compat import assert_model_supports_synth_lang


def test_english_ok_on_onnx():
    assert_model_supports_synth_lang("model_q8f16", "en-us")
    assert_model_supports_synth_lang("model_q8f16", "auto")


def test_german_requires_torch():
    with pytest.raises(ValueError, match="PyTorch"):
        assert_model_supports_synth_lang("model_q8f16", "de")


def test_german_ok_on_torch():
    assert_model_supports_synth_lang("kokoro-torch", "de")
