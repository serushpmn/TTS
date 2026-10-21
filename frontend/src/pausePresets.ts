export type PausePresetId = "short" | "normal" | "long" | "custom";

export type PausePreset = {
  id: PausePresetId;
  label: string;
  speakerChange: number;
  sameSpeaker: number;
  section: number;
  tag: string;
};

export const PAUSE_PRESETS: PausePreset[] = [
  { id: "short", label: "Short", speakerChange: 1.0, sameSpeaker: 0.2, section: 0.45, tag: "[pause:0.4s]" },
  { id: "normal", label: "Normal", speakerChange: 2.5, sameSpeaker: 0.35, section: 0.85, tag: "[pause]" },
  { id: "long", label: "Long", speakerChange: 3.5, sameSpeaker: 0.6, section: 1.5, tag: "[pause:1.5s]" },
];

export function matchPausePreset(speakerChange: number, sameSpeaker: number): PausePresetId {
  const found = PAUSE_PRESETS.find(
    (preset) =>
      Math.abs(preset.speakerChange - speakerChange) < 0.05 &&
      Math.abs(preset.sameSpeaker - sameSpeaker) < 0.05,
  );
  return found?.id ?? "custom";
}
