/** Stable pastel accents for speakers (light + dark friendly). */
const PALETTE = [
  { id: "coral", bg: "#ff6b4a", ink: "#fff" },
  { id: "teal", bg: "#0d9488", ink: "#fff" },
  { id: "violet", bg: "#7c3aed", ink: "#fff" },
  { id: "amber", bg: "#d97706", ink: "#fff" },
  { id: "sky", bg: "#0284c7", ink: "#fff" },
  { id: "rose", bg: "#e11d48", ink: "#fff" },
] as const;

export type SpeakerColor = (typeof PALETTE)[number];

export function speakerColorAt(index: number): SpeakerColor {
  return PALETTE[Math.abs(index) % PALETTE.length];
}

export function speakerColorById(speakerId: string, speakerIds: string[]): SpeakerColor {
  const index = speakerIds.indexOf(speakerId);
  return speakerColorAt(index < 0 ? 0 : index);
}
