import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { TranslateFn } from "../i18n";
import type { Project } from "../types";

type Props = {
  onOpen: (project: Project) => void;
  onError: (message: string) => void;
  onStatus: (message: string) => void;
  current: Project;
  t: TranslateFn;
};

export function ProjectsPanel({ onOpen, onError, onStatus, current, t }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  async function refresh() {
    setProjects(await api.listProjects());
  }

  useEffect(() => {
    refresh().catch((e) => onError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((project) => {
      const hay = `${project.name} ${project.topic} ${project.mode || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query]);

  async function saveCurrent() {
    try {
      setBusy(true);
      const saved = await api.save({
        ...current,
        id: current.id || crypto.randomUUID(),
        name: current.name || current.topic || "Untitled",
      });
      onStatus(t("projectSaved", { name: saved.name }));
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rename(project: Project) {
    const name = window.prompt(t("renamePrompt"), project.name);
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
      onStatus(t("projectDuplicated"));
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(project: Project) {
    if (!window.confirm(t("confirmDeleteProject", { name: project.name }))) return;
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
        {t("saveWorkspace")}
      </button>
      <label className="panel-search">
        <span className="sr-only">{t("search")}</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchProjects")}
          aria-label={t("searchProjects")}
        />
      </label>
      {!projects.length && <p className="muted">{t("noProjects")}</p>}
      {projects.length > 0 && !filtered.length && <p className="muted">{t("noSearchResults")}</p>}
      {filtered.map((project) => (
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
              {t("open")}
            </button>
            <button type="button" onClick={() => void rename(project)}>
              {t("rename")}
            </button>
            <button type="button" onClick={() => void duplicate(project)}>
              {t("duplicateProject")}
            </button>
            <button type="button" className="danger" onClick={() => void remove(project)}>
              {t("delete")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
