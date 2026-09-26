import pytest
from app.services.parser import parse_conversation


def test_parses_speakers_and_dialogue():
    result = parse_conversation("Sarah: Hello.\nJohn: Hi!")
    assert [(line.speaker_name, line.text) for line in result] == [("Sarah", "Hello."), ("John", "Hi!")]


def test_rejects_invalid_input():
    with pytest.raises(ValueError, match="Line 1"):
        parse_conversation("No separator")
