export type ThemeId = "studio";
export type ModeId = "day" | "night";

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: "studio", label: "Studio" },
];

const THEME_KEY = "dialogue-studio-theme";
const MODE_KEY = "dialogue-studio-mode";

export function loadTheme(): ThemeId {
  return "studio";
}

export function loadMode(): ModeId {
  return localStorage.getItem(MODE_KEY) === "night" ? "night" : "day";
}

export function applyAppearance(_theme: ThemeId, mode: ModeId) {
  const root = document.documentElement;
  root.setAttribute("data-theme", "studio");
  root.setAttribute("data-mode", mode);
  localStorage.setItem(THEME_KEY, "studio");
  localStorage.setItem(MODE_KEY, mode);
}
