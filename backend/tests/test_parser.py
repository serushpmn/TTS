import pytest

from app.services.parser import parse_conversation


def test_parses_speakers_and_dialogue():
    result = parse_conversation("Sarah: Hello.\nJohn: Hi!")
    assert [(line.speaker_name, line.text) for line in result] == [("Sarah", "Hello."), ("John", "Hi!")]


def test_rejects_invalid_input():
    with pytest.raises(ValueError, match="Line 1"):
        parse_conversation("No separator")


def test_parses_bracket_and_dash():
    result = parse_conversation("[Sarah] Hello there\nJohn — Hi back")
    assert result[0].speaker_name == "Sarah"
    assert result[1].speaker_name == "John"


def test_parses_bullet_chat_style():
    result = parse_conversation("- Maya: Salute\n* Alex: Welcome")
    assert [(line.speaker_name, line.text) for line in result] == [
        ("Maya", "Salute"),
        ("Alex", "Welcome"),
    ]


def test_parses_tab_separated():
    result = parse_conversation("Sarah\tHello world\nJohn\tGoodbye")
    assert result[0].text == "Hello world"
    assert result[1].speaker_name == "John"


def test_parses_csv():
    result = parse_conversation("Speaker,Text\nSarah,Hello\nJohn,Hi")
    assert [(line.speaker_name, line.text) for line in result] == [("Sarah", "Hello"), ("John", "Hi")]


def test_parses_srt_with_speaker():
    srt = """1
00:00:00,000 --> 00:00:01,500
Sarah: Hello everyone

2
00:00:01,500 --> 00:00:03,000
John: Welcome
"""
    result = parse_conversation(srt)
    assert result[0].speaker_name == "Sarah"
    assert result[1].speaker_name == "John"


def test_parses_srt_without_speaker_as_narrator():
    srt = """1
00:00:00,000 --> 00:00:02,000
Once upon a time
"""
    result = parse_conversation(srt)
    assert result[0].speaker_name == "Narrator"
    assert "Once upon a time" in result[0].text
