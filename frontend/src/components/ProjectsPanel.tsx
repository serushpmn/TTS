import { useEffect, useState } from "react";
import { api } from "../api";
import type { Project } from "../types";

type Props = {
  onOpen: (project: Project) => void;
  onError: (message: string) => void;
  onStatus: (message: string) => void;
  current: Project;
};

export function ProjectsPanel({ onOpen, onError, onStatus, current }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setProjects(await api.listProjects());
  }

  useEffect(() => {
    refresh().catch((e) => onError(e.message));
  }, []);

  async function saveCurrent() {
    try {
      setBusy(true);
      const saved = await api.save({
        ...current,
        id: current.id || crypto.randomUUID(),
        name: current.name || current.topic || "Untitled",
      });
      onStatus(`Saved project “${saved.name}”`);
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rename(project: Project) {
    const name = window.prompt("Rename project", project.name);
    if (!name?.trim()) return;
    try {
      setBusy(true);
      await api.save({ ...project, name: name.trim() });
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(project: Project) {
    try {
      setBusy(true);
      await api.duplicateProject(project.id);
      onStatus("Project duplicated");
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete project “${project.name}”? Audio files are not deleted.`)) return;
    try {
      setBusy(true);
      await api.deleteProject(project.id);
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-body project-panel">
      <button type="button" disabled={busy} onClick={() => void saveCurrent()}>
        Save current workspace
      </button>
      {!projects.length && <p className="muted">No saved projects yet.</p>}
      {projects.map((project) => (
        <div className="history-item" key={project.id}>
          <div>
            <strong>{project.name}</strong>
            <div className="muted">
              {project.mode || "dialogue"} · {project.topic}
              {project.updated_at ? ` · ${new Date(project.updated_at).toLocaleString()}` : ""}
            </div>
          </div>
          <div className="history-actions">
            <button type="button" onClick={() => onOpen(project)}>
              Open
            </button>
            <button type="button" onClick={() => void rename(project)}>
              Rename
            </button>
            <button type="button" onClick={() => void duplicate(project)}>
              Duplicate
            </button>
            <button type="button" className="danger" onClick={() => void remove(project)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
