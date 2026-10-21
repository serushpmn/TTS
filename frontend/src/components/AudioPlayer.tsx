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
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate, src]);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
  }, [src]);

  function toggle() {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="audio-player custom-player">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      {label && <div className="audio-player-label muted">{label}</div>}
      <div className="player-row">
        <button type="button" className="player-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="player-wave" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => {
            const active = progress > (i / 28) * 100;
            const h = 28 + ((i * 17) % 40);
            return <span key={i} className={active ? "on" : ""} style={{ height: `${h}%` }} />;
          })}
        </div>
        <input
          className="player-seek"
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={current}
          aria-label="Seek"
          onChange={(e) => {
            const next = Number(e.target.value);
            const audio = ref.current;
            if (audio) audio.currentTime = next;
            setCurrent(next);
          }}
        />
        <span className="player-time muted">
          {formatTime(current)} / {formatTime(duration)}
        </span>
      </div>
      <div className="audio-player-meta">
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
