type Props = { gender: string; size?: number };

/** Simple SVG avatars — no network images required. */
export function VoiceAvatar({ gender, size = 36 }: Props) {
  const male = gender.toLowerCase().startsWith("m");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={`voice-avatar ${male ? "male" : "female"}`}
    >
      <circle cx="20" cy="20" r="20" fill={male ? "#3d4f5f" : "#6b4f6b"} />
      <circle cx="20" cy="15" r="7" fill="#f3ebe3" />
      <path d={male ? "M8 36c2-8 8-12 12-12s10 4 12 12" : "M7 36c2-9 8-13 13-13s11 4 13 13"} fill="#f3ebe3" />
    </svg>
  );
}
