from __future__ import annotations

import re
from dataclasses import dataclass


LINE = re.compile(r"^\s*([^:\n]{1,60})\s*:\s*(.+?)\s*$")


@dataclass(frozen=True)
class ParsedLine:
    speaker_name: str
    text: str


def parse_conversation(raw_text: str) -> list[ParsedLine]:
    """Parse one `Speaker: text` turn per non-empty line."""
    parsed: list[ParsedLine] = []
    for number, line in enumerate(raw_text.splitlines(), start=1):
        if not line.strip():
            continue
        match = LINE.match(line)
        if not match:
            raise ValueError(f"Line {number} must use the format 'Speaker: dialogue'.")
        parsed.append(ParsedLine(match.group(1).strip(), " ".join(match.group(2).split())))
    if not parsed:
        raise ValueError("Paste at least one dialogue line.")
    return parsed
