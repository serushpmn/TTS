export type IconName =
  | "sun"
  | "moon"
  | "help"
  | "import"
  | "history"
  | "reset"
  | "play"
  | "pause"
  | "random"
  | "close"
  | "add"
  | "stop"
  | "model"
  | "project"
  | "bench"
  | "more"
  | "settings"
  | "panel"
  | "up"
  | "down"
  | "duplicate"
  | "regen"
  | "download"
  | "document"
  | "smile"
  | "bubble"
  | "bubbles"
  | "headphones"
  | "pauseShort"
  | "pauseLong"
  | "slow"
  | "chevrondown"
  | "spinner";

const common = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const props = { ...common, width: size, height: size };
  switch (name) {
    case "sun":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...props}>
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
        </svg>
      );
    case "help":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.4 1-1.4 1.8V14" />
          <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "import":
      return (
        <svg {...props}>
          <path d="M12 3v12" />
          <path d="M8 11l4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      );
    case "history":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "reset":
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      );
    case "play":
      return (
        <svg {...props}>
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "pause":
      return (
        <svg {...props}>
          <path d="M8 5v14M16 5v14" />
        </svg>
      );
    case "random":
      return (
        <svg {...props}>
          <path d="M4 7h4l3 5 3-5h6" />
          <path d="M17 4l3 3-3 3" />
          <path d="M4 17h4l2.5-3.5" />
          <path d="M14.5 13.5 17 17h3" />
          <path d="M17 14l3 3-3 3" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "add":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "stop":
      return (
        <svg {...props}>
          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "model":
      return (
        <svg {...props}>
          <path d="M4 7h16v10H4z" />
          <path d="M8 7V5h8v2M9 11h6M9 14h4" />
        </svg>
      );
    case "project":
      return (
        <svg {...props}>
          <path d="M4 6h6l2 2h8v10H4z" />
        </svg>
      );
    case "bench":
      return (
        <svg {...props}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      );
    case "more":
      return (
        <svg {...props}>
          <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case "panel":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      );
    case "up":
      return (
        <svg {...props}>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      );
    case "down":
      return (
        <svg {...props}>
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      );
    case "duplicate":
      return (
        <svg {...props}>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M4 16V6a2 2 0 0 1 2-2h10" />
        </svg>
      );
    case "regen":
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 19h14" />
        </svg>
      );
    case "document":
      return (
        <svg {...props}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6M9 13h6M9 17h4" />
        </svg>
      );
    case "smile":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5" />
          <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "bubble":
      return (
        <svg {...props}>
          <path d="M21 12a7.5 7.5 0 0 1-7.5 7.5H7l-4 3V12A7.5 7.5 0 0 1 18 7.2" />
        </svg>
      );
    case "bubbles":
      return (
        <svg {...props}>
          <path d="M14 15.5a5.5 5.5 0 0 1-5.5 5.5H5l-2.5 2V15.5A5.5 5.5 0 0 1 14 12" />
          <path d="M21 9.5A5.5 5.5 0 0 1 15.5 15H14V9.5A5.5 5.5 0 1 1 21 9.5z" />
        </svg>
      );
    case "headphones":
      return (
        <svg {...props}>
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
          <path d="M4 14v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2zM18 14v6h1a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1z" />
        </svg>
      );
    case "pauseShort":
      return (
        <svg {...props}>
          <path d="M10 8v8M14 8v8" />
        </svg>
      );
    case "pauseLong":
      return (
        <svg {...props}>
          <path d="M7 7v10M12 5v14M17 7v10" />
        </svg>
      );
    case "slow":
      return (
        <svg {...props}>
          <path d="M12 19a7 7 0 1 0-7-7" />
          <path d="M12 12l4-3" />
          <path d="M5 19h14" />
        </svg>
      );
    case "chevrondown":
      return (
        <svg {...props}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "spinner":
      return (
        <svg {...props} className="icon-spin">
          <path d="M12 3a9 9 0 1 1-9 9" />
        </svg>
      );
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

export function tagIcon(tag: string): IconName {
  if (tag.includes("laugh")) return "smile";
  if (tag.includes("slow")) return "slow";
  if (tag.includes("0.4") || tag.includes("short")) return "pauseShort";
  if (tag.includes("1.5") || tag.includes("long")) return "pauseLong";
  if (tag.includes("pause")) return "pause";
  return "document";
}
