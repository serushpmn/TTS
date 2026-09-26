from __future__ import annotations

import json
from pathlib import Path

from app.config import settings
from app.models.schemas import Project


PROJECTS_FILE = settings.data_dir / "projects.json"


def _read() -> dict[str, dict]:
    if not PROJECTS_FILE.exists():
        return {}
    return json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))


def list_projects() -> list[Project]:
    return [Project.model_validate(value) for value in _read().values()]


def save_project(project: Project) -> Project:
    values = _read()
    values[project.id] = project.model_dump()
    PROJECTS_FILE.write_text(json.dumps(values, indent=2), encoding="utf-8")
    return project


def delete_project(project_id: str) -> bool:
    values = _read()
    if project_id not in values:
        return False
    del values[project_id]
    PROJECTS_FILE.write_text(json.dumps(values, indent=2), encoding="utf-8")
    return True
