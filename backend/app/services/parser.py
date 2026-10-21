from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass


# Speaker: text  |  Speaker：text  |  - Speaker: text
COLON_LINE = re.compile(
    r"^\s*[-*•]?\s*([^:\n\t\[\]【】]{1,60}?)\s*[:：]\s*(.+?)\s*$"
)
# [Speaker] text  or  【Speaker】text
BRACKET_LINE = re.compile(r"^\s*[\[【]\s*([^\]】]{1,60}?)\s*[\]】]\s*(.+?)\s*$")
# Speaker — text  /  Speaker - text  /  Speaker – text
DASH_LINE = re.compile(r"^\s*([^:\n\t\-–—]{1,60}?)\s+[–—-]\s+(.+?)\s*$")
# Speaker<TAB>text
TAB_LINE = re.compile(r"^\s*([^\t\n]{1,60}?)\t+(.+?)\s*$")
SRT_INDEX = re.compile(r"^\d+$")
SRT_TIME = re.compile(
    r"^\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}"
)


@dataclass(frozen=True)
class ParsedLine:
    speaker_name: str
    text: str


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _parse_single_line(line: str) -> ParsedLine | None:
    stripped = line.strip()
    if not stripped:
        return None
    for pattern in (COLON_LINE, BRACKET_LINE, TAB_LINE, DASH_LINE):
        match = pattern.match(stripped)
        if match:
            name = match.group(1).strip().strip('"').strip("'")
            text = _clean_text(match.group(2).strip().strip('"').strip("'"))
            if name and text:
                return ParsedLine(name, text)
    return None


def _parse_csv_block(raw_text: str) -> list[ParsedLine] | None:
    """Try comma/semicolon CSV with two columns: speaker, text."""
    sample = raw_text.lstrip()
    if "," not in sample and ";" not in sample:
        return None
    dialect_delim = ";" if sample.count(";") > sample.count(",") else ","
    try:
        reader = csv.reader(io.StringIO(raw_text), delimiter=dialect_delim)
        rows = [row for row in reader if any(cell.strip() for cell in row)]
    except csv.Error:
        return None
    if len(rows) < 1:
        return None
    parsed: list[ParsedLine] = []
    for row in rows:
        if len(row) < 2:
            return None
        name = row[0].strip().strip('"')
        text = _clean_text(row[1].strip().strip('"'))
        # Skip header-like first row.
        if not parsed and name.lower() in ("speaker", "name", "character") and text.lower() in (
            "text",
            "dialogue",
            "line",
            "content",
        ):
            continue
        if not name or not text:
            return None
        # Reject if first column looks like a full sentence (false positive CSV).
        if " " in name and len(name) > 40:
            return None
        parsed.append(ParsedLine(name, text))
    return parsed or None


def _looks_like_srt(raw_text: str) -> bool:
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    if len(lines) < 2:
        return False
    timed = sum(1 for ln in lines if SRT_TIME.match(ln))
    return timed >= 1 and (SRT_INDEX.match(lines[0]) is not None or timed >= 2)


def _parse_srt(raw_text: str) -> list[ParsedLine]:
    blocks = re.split(r"\n\s*\n", raw_text.strip())
    parsed: list[ParsedLine] = []
    for block in blocks:
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        # Drop index + timestamp rows.
        body: list[str] = []
        for ln in lines:
            if SRT_INDEX.match(ln) or SRT_TIME.match(ln):
                continue
            body.append(ln)
        if not body:
            continue
        joined = " ".join(body)
        single = _parse_single_line(joined) or _parse_single_line(body[0])
        if single:
            # If only first line had speaker, append rest of cue text.
            if len(body) > 1 and single.text == _clean_text(body[0].split(":", 1)[-1] if ":" in body[0] else body[0]):
                rest = _clean_text(" ".join(body[1:]))
                if rest and rest not in single.text:
                    single = ParsedLine(single.speaker_name, _clean_text(f"{single.text} {rest}"))
            parsed.append(single)
        else:
            parsed.append(ParsedLine("Narrator", _clean_text(joined)))
    if not parsed:
        raise ValueError("Could not find dialogue cues in this SRT.")
    return parsed


def parse_conversation(raw_text: str) -> list[ParsedLine]:
    """Parse dialogue from Speaker: lines, SRT, CSV/TSV, brackets, or dash turns."""
    if not raw_text or not raw_text.strip():
        raise ValueError("Paste at least one dialogue line.")

    if _looks_like_srt(raw_text):
        return _parse_srt(raw_text)

    csv_parsed = _parse_csv_block(raw_text)
    if csv_parsed and len(csv_parsed) >= 1:
        # Prefer CSV only when most lines parse that way and colon style would fail badly.
        colonish = sum(1 for ln in raw_text.splitlines() if COLON_LINE.match(ln.strip() or ""))
        if colonish < len(csv_parsed):
            return csv_parsed

    parsed: list[ParsedLine] = []
    for number, line in enumerate(raw_text.splitlines(), start=1):
        if not line.strip():
            continue
        item = _parse_single_line(line)
        if not item:
            raise ValueError(
                f"Line {number} must look like 'Speaker: dialogue', '[Speaker] dialogue', "
                f"'Speaker - dialogue', tab-separated, CSV, or SRT."
            )
        parsed.append(item)
    if not parsed:
        raise ValueError("Paste at least one dialogue line.")
    return parsed
