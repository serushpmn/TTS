import type { ChatTheme } from "./bubbles";
import type { AppMode, Message, Speaker } from "./types";

const DRAFT_KEY = "dialogue-studio-draft-v1";

export type WorkspaceDraft = {
  appMode: AppMode;
  topic: string;
  speakers: Speaker[];
  messages: Message[];
  pause: number;
  lectureText: string;
  narratorVoice: string;
  narratorSpeed: number;
  sectionPause: number;
  chatTheme?: ChatTheme;
  savedAt: string;
};

export function loadDraft(): WorkspaceDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<WorkspaceDraft, "savedAt">) {
  try {
    const payload: WorkspaceDraft = { ...draft, savedAt: new Date().toISOString() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `~${minutes}m ${rest}s` : `~${minutes}m`;
}
