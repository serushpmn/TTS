export type Voice = { id: string; name: string; gender: string; accent: string; language: string; engine: string };
export type Speaker = { id: string; name: string; voice_id: string; speed: number };
export type Message = { id: string; speaker_id: string; text: string };
export type Project = {
  id: string;
  name: string;
  topic: string;
  speakers: Speaker[];
  messages: Message[];
  speaker_change_pause: number;
  audio_url?: string;
};
export type HistoryItem = {
  id: string;
  topic: string;
  filename: string;
  url: string;
  mp3_filename?: string | null;
  mp3_url?: string | null;
  messages: number;
  created_at: string;
};
export type GenerateJob = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  stage: string;
  current: number;
  total: number;
  percent: number;
  eta_seconds: number | null;
  url?: string | null;
  filename?: string | null;
  mp3_url?: string | null;
  mp3_filename?: string | null;
  history_id?: string | null;
  error?: string | null;
};
