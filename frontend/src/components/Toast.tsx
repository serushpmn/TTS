import { useEffect } from "react";

type Props = {
  message: string;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

export function Toast({ message, onDismiss, actionLabel, onAction, durationMs = 3000 }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  return (
    <div className="toast" role="status">
      <span>{message}</span>
      <div className="toast-actions">
        {actionLabel && onAction && (
          <button type="button" className="quiet-btn" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        <button type="button" className="quiet-btn" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
