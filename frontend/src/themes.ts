export type ThemeId = "mono" | "ocean" | "sand" | "orchid";
export type ModeId = "day" | "night";

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: "mono", label: "Mono" },
  { id: "ocean", label: "Ocean" },
  { id: "sand", label: "Sand" },
  { id: "orchid", label: "Orchid" },
];

const THEME_KEY = "dialogue-studio-theme";
const MODE_KEY = "dialogue-studio-mode";

export function loadTheme(): ThemeId {
  const value = localStorage.getItem(THEME_KEY);
  return THEMES.some((theme) => theme.id === value) ? (value as ThemeId) : "mono";
}

export function loadMode(): ModeId {
  return localStorage.getItem(MODE_KEY) === "night" ? "night" : "day";
}

export function applyAppearance(theme: ThemeId, mode: ModeId) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-mode", mode);
  localStorage.setItem(THEME_KEY, theme);
  localStorage.setItem(MODE_KEY, mode);
}
