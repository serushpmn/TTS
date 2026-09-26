from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from uuid import uuid4

from app.config import settings
from app.models.schemas import HistoryItem


HISTORY_FILE = settings.data_dir / "history.json"


def _read() -> list[dict]:
    if not HISTORY_FILE.exists():
        return []
    return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))


def _write(items: list[dict]) -> None:
    HISTORY_FILE.write_text(json.dumps(items, indent=2), encoding="utf-8")


def list_history() -> list[HistoryItem]:
    items = sorted(_read(), key=lambda item: item.get("created_at", ""), reverse=True)
    return [HistoryItem.model_validate(item) for item in items]


def add_history(
    topic: str,
    filename: str,
    url: str,
    messages: int,
    mp3_filename: str | None = None,
    mp3_url: str | None = None,
) -> HistoryItem:
    item = HistoryItem(
        id=uuid4().hex,
        topic=topic,
        filename=filename,
        url=url,
        mp3_filename=mp3_filename,
        mp3_url=mp3_url,
        messages=messages,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    values = _read()
    values.append(item.model_dump())
    _write(values)
    return item


def delete_history(item_id: str) -> HistoryItem | None:
    values = _read()
    kept: list[dict] = []
    removed: dict | None = None
    for item in values:
        if item.get("id") == item_id:
            removed = item
        else:
            kept.append(item)
    if not removed:
        return None
    _write(kept)
    for key in ("filename", "mp3_filename"):
        name = removed.get(key)
        if not name:
            continue
        path = settings.output_dir / Path(name).name
        if path.exists():
            path.unlink()
    return HistoryItem.model_validate(removed)
