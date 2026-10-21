from __future__ import annotations

from app.services.tone import apply_tone_to_text, get_tone


def test_calm_tone_adds_prefix():
    text = apply_tone_to_text("Hello there", "calm")
    assert text.startswith("[pause")
    assert "Hello there" in text


def test_neutral_unchanged():
    assert apply_tone_to_text("Hello", "neutral") == "Hello"


def test_unknown_tone_raises():
    try:
        get_tone("angry-robot")
        assert False
    except ValueError:
        pass
