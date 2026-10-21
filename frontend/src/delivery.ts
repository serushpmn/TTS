import type { SynthLanguage } from "./types";

/** True when selected model cannot synthesize this language (ONNX + experimental langs). */
export function engineLangConflict(
  modelId: string,
  synthLang: string,
  languages: SynthLanguage[],
): string | null {
  if (!synthLang || synthLang === "auto") return null;
  const lang = languages.find((item) => item.id === synthLang);
  if (!lang) return null;
  const isOnnx = modelId !== "kokoro-torch";
  if (lang.engine === "torch" && isOnnx) {
    return `${lang.label} requires the PyTorch engine (kokoro-torch). Switch model in Models, or choose English.`;
  }
  return null;
}

export function exportBasename(topic: string, when: Date = new Date()): string {
  const slug =
    topic
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "conversation";
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, "0");
  const d = String(when.getDate()).padStart(2, "0");
  return `${slug}-${y}${m}${d}`;
}

export function filenameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const part = url.split("/").pop();
  return part || null;
}
