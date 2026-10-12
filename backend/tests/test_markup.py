from __future__ import annotations

from app.services.markup import parse_markup


def test_parse_markup_pause_and_laugh():
    parts = parse_markup("Hello [pause:1.5s] there [laugh] okay")
    assert parts[0].kind == "speech" and parts[0].value == "Hello"
    assert parts[1].kind == "pause" and parts[1].seconds == 1.5
    assert parts[2].kind == "speech" and parts[2].value == "there"
    assert parts[3].kind == "effect" and parts[3].value == "ha ha ha"
    assert parts[4].kind == "speech" and parts[4].value == "okay"


def test_default_pause_duration():
    parts = parse_markup("Wait [pause] now")
    assert parts[1].kind == "pause"
    assert parts[1].seconds == 0.8


def test_parse_markup_slow():
    parts = parse_markup("Hello [slow] carefully now")
    assert parts[0].kind == "speech" and parts[0].value == "Hello"
    assert parts[1].kind == "speed" and parts[1].rate == 0.75
    assert parts[2].kind == "speech" and parts[2].value == "carefully now"
