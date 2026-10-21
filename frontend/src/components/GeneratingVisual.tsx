import { Icon } from "./Icons";

type Props = {
  percent: number;
  stage: string;
  etaLabel: string;
  onCancel: () => void;
  cancelLabel: string;
};

/** Soft orb + waveform while audio is generating. */
export function GeneratingVisual({ percent, stage, etaLabel, onCancel, cancelLabel }: Props) {
  const bars = 24;
  return (
    <div className="gen-visual" role="status" aria-live="polite" aria-busy="true">
      <div className="gen-orb" aria-hidden="true">
        <span className="gen-orb-core" />
        <span className="gen-orb-ring" />
        <span className="gen-orb-ring delay" />
      </div>
      <div className="gen-wave" aria-hidden="true">
        {Array.from({ length: bars }, (_, i) => (
          <span key={i} style={{ animationDelay: `${(i % 8) * 0.08}s` }} />
        ))}
      </div>
      <div className="progress-meta">
        <strong>{stage}</strong>
        <span>
          {etaLabel} · {Math.round(percent)}%
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.max(percent, 4)}%` }} />
      </div>
      <button type="button" className="danger gen-cancel" onClick={onCancel}>
        <Icon name="stop" /> {cancelLabel}
      </button>
    </div>
  );
}
