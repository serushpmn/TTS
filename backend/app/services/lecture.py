from __future__ import annotations

import re


SENTENCE_SPLIT = re.compile(r"(?<=[.!?…])\s+(?=[A-Z\"'(])")
MAX_CHUNK_CHARS = 420


def _normalize_paragraph(text: str) -> str:
    return " ".join(text.split()).strip()


def _split_long_paragraph(paragraph: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    paragraph = _normalize_paragraph(paragraph)
    if not paragraph:
        return []
    if len(paragraph) <= max_chars:
        return [paragraph]

    sentences = SENTENCE_SPLIT.split(paragraph)
    if len(sentences) == 1:
        # Hard-wrap very long run-on text by words.
        words = paragraph.split(" ")
        chunks: list[str] = []
        current: list[str] = []
        length = 0
        for word in words:
            extra = len(word) + (1 if current else 0)
            if current and length + extra > max_chars:
                chunks.append(" ".join(current))
                current = [word]
                length = len(word)
            else:
                current.append(word)
                length += extra
        if current:
            chunks.append(" ".join(current))
        return chunks

    chunks = []
    current = ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if not current:
            current = sentence
            continue
        candidate = f"{current} {sentence}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = sentence
    if current:
        chunks.append(current)

    # Recurse if a single sentence is still too long.
    final: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            final.append(chunk)
        else:
            final.extend(_split_long_paragraph(chunk, max_chars))
    return final


def split_lecture_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """
    Split a long lecture/presentation script into synthesis-friendly chunks.

    Prefer blank-line paragraphs, then sentences, then word wrapping.
    """
    raw = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        raise ValueError("Lecture text cannot be empty.")

    paragraphs = re.split(r"\n\s*\n+", raw)
    if len(paragraphs) == 1 and "\n" in raw:
        # Single block with line breaks but no blank lines — treat lines as soft paragraphs
        # only when they look like separate thoughts; otherwise keep as one paragraph.
        paragraphs = [raw]

    chunks: list[str] = []
    for paragraph in paragraphs:
        # Keep intentional single newlines as spaces so Kokoro gets clean prose.
        cleaned = _normalize_paragraph(paragraph)
        if not cleaned:
            continue
        chunks.extend(_split_long_paragraph(cleaned, max_chars))

    if not chunks:
        raise ValueError("Lecture text cannot be empty.")
    return chunks
