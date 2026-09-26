from __future__ import annotations

from app.models.schemas import Message, Project, Speaker
from app.services.storage import delete_project, list_projects, save_project


def test_save_list_and_delete_project(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.storage.PROJECTS_FILE", tmp_path / "projects.json")

    project = Project(
        id="demo",
        name="Demo",
        speakers=[Speaker(id="s1", name="Sarah", voice_id="af_heart")],
        messages=[Message(id="m1", speaker_id="s1", text="Hello there")],
        speaker_change_pause=2.5,
    )

    save_project(project)
    listed = list_projects()
    assert len(listed) == 1
    assert listed[0].name == "Demo"
    assert delete_project("demo") is True
    assert list_projects() == []
    assert delete_project("missing") is False
