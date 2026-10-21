from __future__ import annotations

from app.models.schemas import Voice
from app.services.voice_samples import sample_url

# Official Kokoro-82M English voice-pack identifiers.  The engine verifies each
# selected voice at synthesis time and downloads its pack lazily from Hugging Face.
_VOICE_DATA = (
    ("af_heart", "Heart", "Female", "American"), ("af_bella", "Bella", "Female", "American"),
    ("af_nicole", "Nicole", "Female", "American"), ("af_sarah", "Sarah", "Female", "American"),
    ("af_sky", "Sky", "Female", "American"), ("af_aoede", "Aoede", "Female", "American"),
    ("af_kore", "Kore", "Female", "American"), ("af_jessica", "Jessica", "Female", "American"),
    ("af_river", "River", "Female", "American"), ("af_alloy", "Alloy", "Female", "American"),
    ("af_nova", "Nova", "Female", "American"), ("am_michael", "Michael", "Male", "American"),
    ("am_adam", "Adam", "Male", "American"), ("am_eric", "Eric", "Male", "American"),
    ("am_liam", "Liam", "Male", "American"), ("am_onyx", "Onyx", "Male", "American"),
    ("am_echo", "Echo", "Male", "American"), ("am_fenrir", "Fenrir", "Male", "American"),
    ("am_puck", "Puck", "Male", "American"), ("bf_alice", "Alice", "Female", "British"),
    ("bf_emma", "Emma", "Female", "British"), ("bf_isabella", "Isabella", "Female", "British"),
    ("bf_lily", "Lily", "Female", "British"), ("bm_daniel", "Daniel", "Male", "British"),
    ("bm_george", "George", "Male", "British"), ("bm_lewis", "Lewis", "Male", "British"),
)


def _voice(id_: str, name: str, gender: str, accent: str) -> Voice:
    return Voice(
        id=id_,
        name=name,
        gender=gender,
        accent=accent,
        avatar="male" if gender == "Male" else "female",
        sample_url=sample_url(id_),
    )


def list_voices() -> list[Voice]:
    return [_voice(id_, name, gender, accent) for id_, name, gender, accent in _VOICE_DATA]


# Eager list for simple imports; sample_url may be stale until list_voices() is called.
VOICES = list_voices()


def find_voice(voice_id: str) -> Voice:
    return next((voice for voice in list_voices() if voice.id == voice_id), None) or (_raise(voice_id))


def _raise(voice_id: str) -> Voice:
    raise ValueError(f"Unsupported Kokoro voice '{voice_id}'.")
