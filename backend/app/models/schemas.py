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
    text: str

    @field_validator("text")
    @classmethod
    def normalized_text(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Dialogue text cannot be empty.")
        return value


class ConversationRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)
    speakers: list[Speaker] = Field(min_length=1)
    speaker_change_pause: float = Field(default=2.5, ge=1.0, le=4.0)
    topic: str = Field(default="conversation", min_length=1, max_length=120)


class PreviewRequest(BaseModel):
    text: str = Field(min_length=1)
    voice_id: str
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


class Project(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=120)
    topic: str = Field(default="conversation", min_length=1, max_length=120)
    messages: list[Message]
    speakers: list[Speaker]
    speaker_change_pause: float = Field(default=2.5, ge=1.0, le=4.0)
    audio_url: str | None = None


class HistoryItem(BaseModel):
    id: str
    topic: str
    filename: str
    url: str
    mp3_filename: str | None = None
    mp3_url: str | None = None
    messages: int
    created_at: str
