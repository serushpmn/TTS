from __future__ import annotations

from app.services.lecture import split_lecture_text


def test_split_by_paragraphs():
    text = "First paragraph here.\n\nSecond paragraph here."
    chunks = split_lecture_text(text)
    assert chunks == ["First paragraph here.", "Second paragraph here."]


def test_split_long_paragraph_into_sentences():
    text = (
        "Alpha sentence one. Beta sentence two is also here. "
        "Gamma continues with more words to grow the length. "
        "Delta finishes this block cleanly."
    )
    chunks = split_lecture_text(text, max_chars=80)
    assert len(chunks) >= 2
    assert all(len(chunk) <= 120 for chunk in chunks)
    assert " ".join(chunks).replace("  ", " ").startswith("Alpha")


def test_empty_raises():
    try:
        split_lecture_text("   ")
        assert False, "expected ValueError"
    except ValueError:
        pass
