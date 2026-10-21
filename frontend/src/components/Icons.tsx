export function Icon({
  name,
}: {
  name:
    | "sun"
    | "moon"
    | "help"
    | "import"
    | "history"
    | "reset"
    | "play"
    | "random"
    | "close"
    | "add"
    | "stop"
    | "model"
    | "project"
    | "bench";
}) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.4 1-1.4 1.8V14" />
          <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "import":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="M8 11l4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "reset":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "random":
      return (
        <svg {...common}>
          <path d="M4 7h4l3 5 3-5h6" />
          <path d="M17 4l3 3-3 3" />
          <path d="M4 17h4l2.5-3.5" />
          <path d="M14.5 13.5 17 17h3" />
          <path d="M17 14l3 3-3 3" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "add":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "stop":
      return (
        <svg {...common}>
          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "model":
      return (
        <svg {...common}>
          <path d="M4 7h16v10H4z" />
          <path d="M8 7V5h8v2M9 11h6M9 14h4" />
        </svg>
      );
    case "project":
      return (
        <svg {...common}>
          <path d="M4 6h6l2 2h8v10H4z" />
        </svg>
      );
    case "bench":
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      );
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}
