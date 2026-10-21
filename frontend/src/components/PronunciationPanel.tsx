import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";

type Props = {
  onError: (message: string) => void;
  onStatus: (message: string) => void;
};

export function PronunciationPanel({ onError, onStatus }: Props) {
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [word, setWord] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setEntries(await api.getPronunciation());
  }

  useEffect(() => {
    refresh().catch((e) => onError(e.message));
  }, []);

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      const next = await api.upsertPronunciation(word, pronunciation);
      setEntries(next);
      setWord("");
      setPronunciation("");
      onStatus("Pronunciation saved");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(key: string) {
    try {
      setBusy(true);
      setEntries(await api.deletePronunciation(key));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rows = Object.entries(entries).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="drawer-body pronunciation-panel">
      <p className="muted">
        Whole-word replacements applied before synthesis (names, acronyms, hard words). Example: API → A P I.
      </p>
      <form className="pronunciation-form" onSubmit={addEntry}>
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Word / name" required />
        <input
          value={pronunciation}
          onChange={(e) => setPronunciation(e.target.value)}
          placeholder="How it should be spoken"
          required
        />
        <button type="submit" className="primary" disabled={busy}>
          Add / update
        </button>
      </form>
      <div className="pronunciation-list">
        {!rows.length && <p className="muted">Dictionary is empty.</p>}
        {rows.map(([key, value]) => (
          <div className="history-item" key={key}>
            <div>
              <strong>{key}</strong>
              <div className="muted">{value}</div>
            </div>
            <button type="button" className="danger" disabled={busy} onClick={() => void remove(key)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
