import type { AppMode } from "./types";
import type { PausePresetId } from "./pausePresets";

export type ProjectProfileId = "podcast" | "lecture" | "story";

export type ProjectProfile = {
  id: ProjectProfileId;
  labelKey: string;
  hintKey: string;
  mode: AppMode;
  pausePreset: PausePresetId;
  trimSilence: boolean;
  toneId: string;
};

export const PROJECT_PROFILES: ProjectProfile[] = [
  {
    id: "podcast",
    labelKey: "profilePodcast",
    hintKey: "profilePodcastHint",
    mode: "dialogue",
    pausePreset: "short",
    trimSilence: true,
    toneId: "warm",
  },
  {
    id: "lecture",
    labelKey: "profileLecture",
    hintKey: "profileLectureHint",
    mode: "lecture",
    pausePreset: "normal",
    trimSilence: true,
    toneId: "neutral",
  },
  {
    id: "story",
    labelKey: "profileStory",
    hintKey: "profileStoryHint",
    mode: "dialogue",
    pausePreset: "long",
    trimSilence: false,
    toneId: "calm",
  },
];
