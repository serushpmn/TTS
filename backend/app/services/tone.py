from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ToneStyle:
    id: str
    label: str
    description: str
    # Inserted markup applied at the start of the turn (honest approximations).
    prefix_tags: str
    # Multiplier applied on top of speaker speed for subsequent speech.
    speed_rate: float = 1.0


# Kokoro has no native emotion control. These map to speed/pause/vocal approximations only.
TONE_STYLES: tuple[ToneStyle, ...] = (
    ToneStyle(
        id="neutral",
        label="Neutral",
        description="Default delivery — no extra markup.",
        prefix_tags="",
        speed_rate=1.0,
    ),
    ToneStyle(
        id="calm",
        label="Calm",
        description="Slightly slower pace with a short pause.",
        prefix_tags="[pause:0.35s][slow]",
        speed_rate=0.9,
    ),
    ToneStyle(
        id="warm",
        label="Warm",
        description="Gentle pacing; soft lead-in pause.",
        prefix_tags="[pause:0.25s]",
        speed_rate=0.95,
    ),
    ToneStyle(
        id="excited",
        label="Excited",
        description="Faster delivery (not true emotion — speed only).",
        prefix_tags="[fast]",
        speed_rate=1.15,
    ),
    ToneStyle(
        id="urgent",
        label="Urgent",
        description="Quicker pace with minimal pause.",
        prefix_tags="[fast]",
        speed_rate=1.2,
    ),
    ToneStyle(
        id="sad",
        label="Somber",
        description="Slower pace plus a sigh approximation.",
        prefix_tags="[slow][sigh][pause:0.4s]",
        speed_rate=0.85,
    ),
    ToneStyle(
        id="cheerful",
        label="Cheerful",
        description="Slightly faster; optional light laugh cue at start.",
        prefix_tags="[fast]",
        speed_rate=1.1,
    ),
)


def get_tone(tone_id: str | None) -> ToneStyle:
    if not tone_id:
        return TONE_STYLES[0]
    for style in TONE_STYLES:
        if style.id == tone_id:
            return style
    raise ValueError(f"Unknown tone '{tone_id}'.")


def apply_tone_to_text(text: str, tone_id: str | None) -> str:
    style = get_tone(tone_id)
    if not style.prefix_tags:
        return text
    body = text.strip()
    if not body:
        return style.prefix_tags
    return f"{style.prefix_tags} {body}"


def list_tones() -> list[dict]:
    return [
        {
            "id": style.id,
            "label": style.label,
            "description": style.description,
            "prefix_tags": style.prefix_tags,
            "speed_rate": style.speed_rate,
            "native_emotion": False,
        }
        for style in TONE_STYLES
    ]
