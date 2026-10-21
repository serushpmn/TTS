from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class Voice(BaseModel):
    id: str
    name: str
    gender: str
    accent: str
    language: str = "English"
    engine: str = "Kokoro"


class Speaker(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=60)
    voice_id: str
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


class Message(BaseModel):
    id: str
    speaker_id: str
    text: str = Field(max_length=8000)

    @field_validator("text")
    @classmethod
    def normalized_text(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Dialogue text cannot be empty.")
        return value


class ConversationRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=500)
    speakers: list[Speaker] = Field(min_length=1, max_length=12)
    speaker_change_pause: float = Field(default=2.5, ge=0.0, le=4.0)
    same_speaker_pause: float = Field(default=0.35, ge=0.0, le=2.0)
    topic: str = Field(default="conversation", min_length=1, max_length=120)
    model_id: str | None = None


class LectureRequest(BaseModel):
    text: str = Field(min_length=1, max_length=200_000)
    topic: str = Field(default="lecture", min_length=1, max_length=120)
    voice_id: str
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    section_pause: float = Field(default=0.85, ge=0.0, le=3.0)
    model_id: str | None = None

    @field_validator("text")
    @classmethod
    def keep_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Lecture text cannot be empty.")
        return value


class LecturePlan(BaseModel):
    chunks: list[str]
    count: int
    characters: int
    estimated_seconds: int = 0


class PreviewRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice_id: str
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    model_id: str | None = None


class SegmentRegenRequest(BaseModel):
    mode: str = Field(pattern="^(dialogue|lecture)$")
    index: int = Field(ge=0)
    text: str = Field(min_length=1, max_length=8000)
    voice_id: str
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    model_id: str | None = None
    # Full script context for recombine (dialogue messages or lecture chunks).
    messages: list[Message] | None = None
    speakers: list[Speaker] | None = None
    speaker_change_pause: float = Field(default=2.5, ge=0.0, le=4.0)
    same_speaker_pause: float = Field(default=0.35, ge=0.0, le=2.0)
    lecture_chunks: list[str] | None = None
    section_pause: float = Field(default=0.85, ge=0.0, le=3.0)
    topic: str = Field(default="conversation", min_length=1, max_length=120)


class Project(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=120)
    topic: str = Field(default="conversation", min_length=1, max_length=120)
    mode: str = Field(default="dialogue", pattern="^(dialogue|lecture)$")
    messages: list[Message] = Field(default_factory=list)
    speakers: list[Speaker] = Field(default_factory=list)
    speaker_change_pause: float = Field(default=2.5, ge=0.0, le=4.0)
    same_speaker_pause: float = Field(default=0.35, ge=0.0, le=2.0)
    lecture_text: str = ""
    narrator_voice: str = "af_heart"
    narrator_speed: float = Field(default=1.0, ge=0.5, le=2.0)
    section_pause: float = Field(default=0.85, ge=0.0, le=3.0)
    model_id: str | None = None
    audio_url: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class HistoryItem(BaseModel):
    id: str
    topic: str
    filename: str
    url: str
    mp3_filename: str | None = None
    mp3_url: str | None = None
    messages: int
    model_id: str | None = None
    created_at: str


class PrefsUpdate(BaseModel):
    selected_model_id: str | None = None
    playback_rate: float | None = Field(default=None, ge=0.5, le=2.0)


class BenchmarkRequest(BaseModel):
    model_ids: list[str] = Field(default_factory=list)
    text: str = Field(
        default="Life is like a box of chocolates. You never know what you're gonna get.",
        min_length=1,
        max_length=500,
    )
    voice_id: str = "af_heart"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    include_listening_samples: bool = False
