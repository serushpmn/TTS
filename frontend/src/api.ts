import type { GenerateJob, HistoryItem, Project, Voice } from "./types";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const location = Array.isArray((item as { loc?: unknown }).loc)
            ? (item as { loc: unknown[] }).loc.join(".")
            : "";
          return location ? `${location}: ${(item as { msg: string }).msg}` : (item as { msg: string }).msg;
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "Request failed";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(formatDetail(data.detail) || "Request failed");
  return data as T;
}

export const api = {
  base: BASE,
  voices: () => request<Voice[]>("/api/voices"),
  parse: (text: string) =>
    request<{ speaker_name: string; text: string }[]>("/api/parse", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  preview: (text: string, voice_id: string, speed: number) =>
    request<{ url: string }>("/api/preview", {
      method: "POST",
      body: JSON.stringify({ text, voice_id, speed }),
    }),
  startGenerate: (project: Project) =>
    request<GenerateJob>("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        messages: project.messages,
        speakers: project.speakers,
        speaker_change_pause: project.speaker_change_pause,
        topic: project.topic || project.name,
      }),
    }),
  generateStatus: (jobId: string) => request<GenerateJob>(`/api/generate/${jobId}`),
  listHistory: () => request<HistoryItem[]>("/api/history"),
  deleteHistory: (id: string) => request<HistoryItem>(`/api/history/${id}`, { method: "DELETE" }),
  listProjects: () => request<Project[]>("/api/projects"),
  save: (project: Project) =>
    request<Project>(`/api/projects/${project.id}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),
  deleteProject: (projectId: string) =>
    request<{ status: string; id: string }>(`/api/projects/${projectId}`, {
      method: "DELETE",
    }),
};
