import type {
  BenchmarkResult,
  DownloadJob,
  GenerateJob,
  HistoryItem,
  LecturePlan,
  LectureRequest,
  ModelInfo,
  OfflineStatus,
  Project,
  Voice,
} from "./types";

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
  if (!response.ok) throw new Error(formatDetail((data as { detail?: unknown }).detail) || "Request failed");
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
  preview: (text: string, voice_id: string, speed: number, model_id?: string | null) =>
    request<{ url: string }>("/api/preview", {
      method: "POST",
      body: JSON.stringify({ text, voice_id, speed, model_id }),
    }),
  startGenerate: (project: Project & { model_id?: string | null }) =>
    request<GenerateJob>("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        messages: project.messages,
        speakers: project.speakers,
        speaker_change_pause: project.speaker_change_pause,
        same_speaker_pause: project.same_speaker_pause ?? 0.35,
        topic: project.topic || project.name,
        model_id: project.model_id,
      }),
    }),
  lecturePlan: (text: string, speed = 1, section_pause = 0.85) =>
    request<LecturePlan>("/api/lecture/plan", {
      method: "POST",
      body: JSON.stringify({ text, speed, section_pause }),
    }),
  startLecture: (payload: LectureRequest) =>
    request<GenerateJob>("/api/lecture", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  generateStatus: (jobId: string) => request<GenerateJob>(`/api/generate/${jobId}`),
  cancelGenerate: (jobId: string) =>
    request<GenerateJob>(`/api/generate/${jobId}/cancel`, { method: "POST" }),
  regenerateSegment: (payload: Record<string, unknown>) =>
    request<{
      url: string;
      filename: string;
      mp3_url: string;
      mp3_filename: string;
      history_id: string;
      model_id: string;
      index: number;
    }>("/api/segments/regenerate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listHistory: () => request<HistoryItem[]>("/api/history"),
  deleteHistory: (id: string) => request<HistoryItem>(`/api/history/${id}`, { method: "DELETE" }),
  listProjects: () => request<Project[]>("/api/projects"),
  save: (project: Project) =>
    request<Project>(`/api/projects/${project.id}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),
  duplicateProject: (projectId: string, name?: string) =>
    request<Project>(`/api/projects/${projectId}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteProject: (projectId: string) =>
    request<{ status: string; id: string }>(`/api/projects/${projectId}`, {
      method: "DELETE",
    }),
  listModels: () => request<ModelInfo[]>("/api/models"),
  selectModel: (modelId: string) => request<ModelInfo>(`/api/models/${modelId}/select`, { method: "POST" }),
  downloadModel: (modelId: string) => request<DownloadJob>(`/api/models/${modelId}/download`, { method: "POST" }),
  downloadVoices: () => request<DownloadJob>("/api/models/voices/download", { method: "POST" }),
  downloadStatus: (jobId: string) => request<DownloadJob>(`/api/models/downloads/${jobId}`),
  cancelDownload: (jobId: string) =>
    request<DownloadJob>(`/api/models/downloads/${jobId}/cancel`, { method: "POST" }),
  loadModel: (modelId: string) => request<{ status: string; model_id: string }>(`/api/models/${modelId}/load`, { method: "POST" }),
  unloadModel: () => request<{ status: string }>("/api/models/unload", { method: "POST" }),
  deleteModel: (modelId: string) => request<ModelInfo>(`/api/models/${modelId}`, { method: "DELETE" }),
  offlineStatus: () => request<OfflineStatus>("/api/status/offline"),
  getPrefs: () => request<{ selected_model_id: string; playback_rate: number }>("/api/prefs"),
  savePrefs: (patch: { selected_model_id?: string; playback_rate?: number }) =>
    request<{ selected_model_id: string; playback_rate: number }>("/api/prefs", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  listBenchmarks: () => request<BenchmarkResult[]>("/api/benchmarks"),
  runBenchmark: (payload: {
    model_ids?: string[];
    text?: string;
    voice_id?: string;
    speed?: number;
    include_listening_samples?: boolean;
  }) =>
    request<BenchmarkResult>("/api/benchmarks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
