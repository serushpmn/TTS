import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  label?: string;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, label, playbackRate = 1, onPlaybackRateChange }: Props) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate, src]);

  return (
    <div className="audio-player">
      {label && <div className="audio-player-label">{label}</div>}
      <audio
        ref={ref}
        src={src}
        controls
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
      />
      <div className="audio-player-meta">
        <span>
          {formatTime(current)} / {formatTime(duration)}
        </span>
        <label>
          Play speed
          <select
            value={playbackRate}
            onChange={(e) => onPlaybackRateChange?.(Number(e.target.value))}
            aria-label="Playback speed"
          >
            {[0.75, 1, 1.25, 1.5].map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
