import type { Message, Speaker } from "./types";

const TAG_RE = /\[(pause(?:\s*[:=]\s*[\d.]+s?)?|laugh(?:ter)?|hahaha|sigh|breath|gasp|cough|slow|fast)\]/gi;

function pauseSecondsFromToken(token: string) {
  const match = /[\d.]+/.exec(token);
  if (!match) return 0.8;
  return Math.max(0.2, Math.min(5, Number(match[0])));
}

/** Rough spoken duration for dialogue before Generate. */
export function estimateDialogueSeconds(
  messages: Message[],
  speakers: Speaker[],
  speakerChangePause: number,
): number {
  const speedById = new Map(speakers.map((speaker) => [speaker.id, Math.max(speaker.speed || 1, 0.5)]));
  let total = 0;

  messages.forEach((message, index) => {
    const baseSpeed = speedById.get(message.speaker_id) ?? 1;
    let activeSpeed = baseSpeed;
    let cursor = 0;
    const text = message.text || "";
    TAG_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TAG_RE.exec(text))) {
      const before = text.slice(cursor, match.index).replace(/\s+/g, " ").trim();
      if (before) total += before.length / (13.5 * activeSpeed);
      const raw = match[1].toLowerCase();
      if (raw.startsWith("pause")) {
        total += pauseSecondsFromToken(raw);
      } else if (raw === "slow") {
        activeSpeed = Math.max(0.5, baseSpeed * 0.75);
      } else if (raw === "fast") {
        activeSpeed = Math.min(2, baseSpeed * 1.25);
      } else if (/laugh|hahaha|sigh|breath|gasp|cough/.test(raw)) {
        total += 0.55 / activeSpeed;
      }
      cursor = match.index + match[0].length;
    }
    const leftover = text.slice(cursor).replace(/\s+/g, " ").trim();
    if (leftover) total += leftover.length / (13.5 * activeSpeed);

    if (index < messages.length - 1) {
      const next = messages[index + 1];
      total += next.speaker_id !== message.speaker_id ? speakerChangePause : 0.35;
    }
  });

  return Math.max(1, Math.round(total));
}
