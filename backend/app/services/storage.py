from __future__ import annotations

from datetime import datetime, timezone
import json
from uuid import uuid4

from app.config import settings
from app.models.schemas import Project
from app.services.atomic import atomic_write_json


PROJECTS_FILE = settings.data_dir / "projects.json"


def _read() -> dict[str, dict]:
    if not PROJECTS_FILE.exists():
        return {}
    return json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))


def list_projects() -> list[Project]:
    projects = [Project.model_validate(value) for value in _read().values()]
    return sorted(projects, key=lambda item: item.updated_at or item.created_at or "", reverse=True)


def get_project(project_id: str) -> Project | None:
    values = _read()
    raw = values.get(project_id)
    return Project.model_validate(raw) if raw else None


def save_project(project: Project) -> Project:
    now = datetime.now(timezone.utc).isoformat()
    data = project.model_copy(deep=True)
    if not data.created_at:
        data.created_at = now
    data.updated_at = now
    values = _read()
    values[data.id] = data.model_dump()
    atomic_write_json(PROJECTS_FILE, values)
    return data


def duplicate_project(project_id: str, new_name: str | None = None) -> Project | None:
    original = get_project(project_id)
    if not original:
        return None
    now = datetime.now(timezone.utc).isoformat()
    clone = original.model_copy(deep=True)
    clone.id = uuid4().hex
    clone.name = new_name or f"{original.name} copy"
    clone.created_at = now
    clone.updated_at = now
    clone.audio_url = None
    return save_project(clone)


def delete_project(project_id: str) -> bool:
    values = _read()
    if project_id not in values:
        return False
    del values[project_id]
    atomic_write_json(PROJECTS_FILE, values)
    return True
