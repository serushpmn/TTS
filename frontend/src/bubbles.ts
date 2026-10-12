export type ChatTheme = "telegram" | "whatsapp" | "imessage";

export const CHAT_THEMES: {
  id: ChatTheme;
  label: string;
}[] = [
  { id: "telegram", label: "Telegram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "imessage", label: "iMessage" },
];

const CHAT_THEME_KEY = "dialogue-studio-chat-theme";

export function loadChatTheme(): ChatTheme {
  const value = localStorage.getItem(CHAT_THEME_KEY);
  if (value === "telegram" || value === "whatsapp" || value === "imessage") return value;
  return "imessage";
}

export function saveChatTheme(theme: ChatTheme) {
  localStorage.setItem(CHAT_THEME_KEY, theme);
}
