from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import Project
from app.services.storage import delete_project, duplicate_project, get_project, list_projects, save_project

router = APIRouter(tags=["projects"])


@router.get("/api/projects", response_model=list[Project])
def projects() -> list[Project]:
    return list_projects()


@router.get("/api/projects/{project_id}", response_model=Project)
def project_detail(project_id: str) -> Project:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@router.put("/api/projects/{project_id}", response_model=Project)
def put_project(project_id: str, project: Project) -> Project:
    if project.id != project_id:
        raise HTTPException(status_code=400, detail="Project ID does not match URL.")
    return save_project(project)


@router.post("/api/projects/{project_id}/duplicate", response_model=Project)
def dup_project(project_id: str, payload: dict | None = None) -> Project:
    name = (payload or {}).get("name")
    project = duplicate_project(project_id, name)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@router.delete("/api/projects/{project_id}")
def remove_project(project_id: str) -> dict[str, str]:
    if not delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"status": "deleted", "id": project_id}
