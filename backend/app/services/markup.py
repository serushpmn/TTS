from __future__ import annotations

from dataclasses import dataclass
import re


TAG_RE = re.compile(
    r"\[(pause(?:\s*[:=]\s*[\d.]+s?)?|laugh(?:ter)?|hahaha|sigh|breath|gasp|cough)\]",
    re.IGNORECASE,
)

EFFECT_VOCALS = {
    "laugh": "ha ha ha",
    "laughter": "ha ha ha",
    "hahaha": "ha ha ha",
    "sigh": "sigh",
    "breath": "huh",
    "gasp": "ah",
    "cough": "cough",
}


@dataclass(frozen=True)
class TextPart:
    kind: str  # "speech" | "pause" | "effect"
    value: str = ""
    seconds: float = 0.0


def _pause_seconds(token: str) -> float:
    match = re.search(r"[\d.]+", token)
    if not match:
        return 0.8
    return max(0.2, min(5.0, float(match.group())))


def parse_markup(text: str) -> list[TextPart]:
    """Split dialogue into speech, pause, and effect parts."""
    parts: list[TextPart] = []
    cursor = 0
    for match in TAG_RE.finditer(text):
        before = text[cursor : match.start()].strip()
        if before:
            parts.append(TextPart("speech", before))
        raw = match.group(1).lower()
        if raw.startswith("pause"):
            parts.append(TextPart("pause", seconds=_pause_seconds(raw)))
        else:
            key = re.sub(r"[^a-z]", "", raw)
            vocal = EFFECT_VOCALS.get(key, "ha ha")
            parts.append(TextPart("effect", vocal))
        cursor = match.end()
    leftover = text[cursor:].strip()
    if leftover:
        parts.append(TextPart("speech", leftover))
    if not parts:
        cleaned = " ".join(text.split())
        if cleaned:
            parts.append(TextPart("speech", cleaned))
    return parts
