import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import type { GenerateJob, HistoryItem, Message, Project, Speaker, Voice } from "./types";

const id = () => crypto.randomUUID();

const initialSpeakers: Speaker[] = [
  { id: id(), name: "Sarah", voice_id: "af_heart", speed: 1 },
  { id: id(), name: "John", voice_id: "am_michael", speed: 1 },
];

const initialMessages = (speakers: Speaker[]): Message[] => [
  { id: id(), speaker_id: speakers[0].id, text: "Hey, how are you doing?" },
  { id: id(), speaker_id: speakers[1].id, text: "I'm doing great. How about you?" },
];

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "conversation";
}

function formatEta(seconds: number | null | undefined) {
  if (seconds == null) return "estimating…";
  if (seconds <= 1) return "almost done";
  if (seconds < 60) return `~${Math.ceil(seconds)}s left`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.ceil(seconds % 60);
  return `~${minutes}m ${rest}s left`;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(44, el.scrollHeight)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function App() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [speakers, setSpeakers] = useState(initialSpeakers);
  const [messages, setMessages] = useState(() => initialMessages(initialSpeakers));
  const [pause, setPause] = useState(2.5);
  const [topic, setTopic] = useState("My dialogue");
  const [importText, setImportText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string>();
  const [audioName, setAudioName] = useState<string>();
  const [mp3Url, setMp3Url] = useState<string>();
  const [mp3Name, setMp3Name] = useState<string>();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<GenerateJob | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(true);

  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const speakerSide = useMemo(() => {
    const map = new Map<string, "left" | "right">();
    speakers.forEach((speaker, index) => map.set(speaker.id, index % 2 === 0 ? "left" : "right"));
    return map;
  }, [speakers]);

  useEffect(() => {
    api.voices().then(setVoices).catch((e) => setError(e.message));
    refreshHistory().catch((e) => setError(e.message));
  }, []);

  async function refreshHistory() {
    setHistory(await api.listHistory());
  }

  const updateMessage = (message: Message, patch: Partial<Message>) =>
    setMessages((items) => items.map((item) => (item.id === message.id ? { ...item, ...patch } : item)));

  const move = (at: number, delta: number) =>
    setMessages((items) => {
      const target = at + delta;
      if (target < 0 || target >= items.length) return items;
      const copy = [...items];
      [copy[at], copy[target]] = [copy[target], copy[at]];
      return copy;
    });

  const makeProject = (): Project => ({
    id: slugify(topic),
    name: topic,
    topic,
    speakers,
    messages,
    speaker_change_pause: pause,
    audio_url: audioUrl,
  });

  function removeSpeaker(speakerId: string) {
    const remaining = speakers.filter((s) => s.id !== speakerId);
    if (!remaining.length) {
      setError("Keep at least one speaker.");
      return;
    }
    const fallback = remaining[0].id;
    setSpeakers(remaining);
    setMessages((items) =>
      items.map((message) =>
        message.speaker_id === speakerId ? { ...message, speaker_id: fallback } : message,
      ),
    );
  }

  async function preview(text: string, speaker: Speaker) {
    try {
      setError("");
      setBusy(true);
      setStatus("Generating preview…");
      const result = await api.preview(text, speaker.voice_id, speaker.speed);
      new Audio(api.base + result.url).play();
      setStatus("Preview ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const empty = messages.find((message) => !message.text.trim());
    if (empty) {
      setError("Fill in every dialogue turn before generating.");
      return;
    }
    if (!topic.trim()) {
      setError("Enter a topic so the final file can be named.");
      return;
    }
    try {
      setError("");
      setBusy(true);
      setStatus("");
      const started = await api.startGenerate(makeProject());
      setJob({ ...started, percent: 1, stage: "Queued…" });
      let latest = started;
      while (latest.status === "queued" || latest.status === "running") {
        await new Promise((resolve) => setTimeout(resolve, 450));
        latest = await api.generateStatus(started.id);
        setJob(latest);
      }
      if (latest.status === "error") throw new Error(latest.error || "Generation failed");
      setAudioUrl(latest.url || undefined);
      setAudioName(latest.filename || undefined);
      setMp3Url(latest.mp3_url || undefined);
      setMp3Name(latest.mp3_filename || undefined);
      setStatus("Conversation ready");
      await refreshHistory();
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function importConversation(event?: FormEvent) {
    event?.preventDefault();
    try {
      setError("");
      const parsed = await api.parse(importText);
      const byName = new Map(speakers.map((s) => [s.name.toLowerCase(), s]));
      const missing = [
        ...new Set(
          parsed
            .map((p) => p.speaker_name)
            .filter((name) => !byName.has(name.toLowerCase())),
        ),
      ];
      let nextSpeakers = speakers;
      if (missing.length) {
        setError(
          `Assign a voice to new speaker${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. They were added with the default voice for you to review.`,
        );
        const additions = missing.map((name) => ({
          id: id(),
          name,
          voice_id: "af_heart",
          speed: 1,
        }));
        additions.forEach((s) => byName.set(s.name.toLowerCase(), s));
        nextSpeakers = [...speakers, ...additions];
        setSpeakers(nextSpeakers);
      }
      setMessages(
        parsed.map((p) => ({
          id: id(),
          speaker_id: byName.get(p.speaker_name.toLowerCase())!.id,
          text: p.text,
        })),
      );
      setImportText("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteHistoryItem(item: HistoryItem) {
    try {
      await api.deleteHistory(item.id);
      if (audioUrl === item.url) {
        setAudioUrl(undefined);
        setAudioName(undefined);
        setMp3Url(undefined);
        setMp3Name(undefined);
      }
      await refreshHistory();
      setStatus(`Deleted “${item.topic}”`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">LOCAL · PRIVATE · KOKORO</span>
          <h1>Dialogue Studio</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={() => setShowHelp((value) => !value)}>
            {showHelp ? "Hide guide" : "Show guide"}
          </button>
          <button className="primary" disabled={busy} onClick={generate}>
            Generate conversation
          </button>
        </div>
      </header>

      <section className="topic-bar panel">
        <label>
          Topic / file name
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Morning coffee chat"
            aria-label="Topic"
          />
        </label>
        <p>
          Files will be saved as <code>{slugify(topic) || "conversation"}.wav</code> and{" "}
          <code>{slugify(topic) || "conversation"}.mp3</code>
        </p>
      </section>

      {showHelp && (
        <section className="panel guide">
          <h2>Expression &amp; pause guide</h2>
          <p>Put these tags inside any message. They are processed before synthesis:</p>
          <ul>
            <li><code>[pause]</code> — short silence (~0.8s)</li>
            <li><code>[pause:1.5s]</code> — exact silence (0.2–5s)</li>
            <li><code>[laugh]</code> / <code>[laughter]</code> — light laughter vocalization</li>
            <li><code>[sigh]</code>, <code>[breath]</code>, <code>[gasp]</code>, <code>[cough]</code></li>
          </ul>
          <p>
            Natural pauses also come from punctuation (<code>...</code>, commas, periods) and from the
            speaker-change pause in Timing. Example:{" "}
            <em>That was hilarious [laugh] [pause:1s] Okay, seriously though...</em>
          </p>
        </section>
      )}

      {error && (
        <div className="notice error">
          {error}
          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {job && (job.status === "queued" || job.status === "running") && (
        <section className="panel progress-panel">
          <div className="progress-meta">
            <strong>{job.stage}</strong>
            <span>{formatEta(job.eta_seconds)}</span>
          </div>
          <div className="progress-track" aria-label="Generation progress">
            <div className="progress-fill" style={{ width: `${Math.max(job.percent, 4)}%` }} />
          </div>
          <div className="progress-meta subtle">
            <span>
              {job.current}/{job.total || messages.length} turns
            </span>
            <span>{Math.round(job.percent)}%</span>
          </div>
        </section>
      )}
      {status && <div className="notice">{status}</div>}

      <section className="layout">
        <div className="editor">
          <section className="panel import">
            <h2>Import conversation</h2>
            <form onSubmit={importConversation}>
              <AutoTextarea
                value={importText}
                onChange={setImportText}
                placeholder={"Sarah: Hey, are you coming tonight?\nJohn: I'll be there around eight."}
              />
              <button type="submit" disabled={busy || !importText.trim()}>
                Parse text
              </button>
            </form>
          </section>

          <div className="section-heading">
            <h2>Conversation</h2>
            <button
              type="button"
              onClick={() =>
                setMessages([
                  ...messages,
                  {
                    id: id(),
                    speaker_id: speakers[messages.length % speakers.length]?.id || speakers[0]?.id || "",
                    text: "",
                  },
                ])
              }
            >
              + Add message
            </button>
          </div>

          <div className="chat">
            {messages.map((message, index) => {
              const speaker = speakerById.get(message.speaker_id);
              const side = speakerSide.get(message.speaker_id) || "left";
              return (
                <article className={`bubble-row ${side}`} key={message.id}>
                  <div className={`bubble ${side}`}>
                    <div className="bubble-meta">
                      <select
                        value={message.speaker_id}
                        onChange={(e) => updateMessage(message, { speaker_id: e.target.value })}
                      >
                        {speakers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <span>{speaker?.voice_id}</span>
                      <div className="bubble-tools">
                        <button type="button" title="Move up" onClick={() => move(index, -1)}>
                          ↑
                        </button>
                        <button type="button" title="Move down" onClick={() => move(index, 1)}>
                          ↓
                        </button>
                        <button
                          type="button"
                          title="Duplicate"
                          onClick={() =>
                            setMessages((items) => {
                              const copy = [...items];
                              copy.splice(index + 1, 0, { ...message, id: id() });
                              return copy;
                            })
                          }
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="danger"
                          title="Delete"
                          onClick={() => setMessages((items) => items.filter((item) => item.id !== message.id))}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <AutoTextarea
                      className="bubble-input"
                      value={message.text}
                      placeholder="What should this person say? You can use [laugh] or [pause:1s]"
                      onChange={(value) => updateMessage(message, { text: value })}
                    />
                    <button
                      type="button"
                      className="preview-btn"
                      disabled={!message.text.trim() || !speaker || busy}
                      onClick={() => speaker && preview(message.text, speaker)}
                    >
                      ▶ Preview
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside>
          <section className="panel">
            <h2>Speakers</h2>
            {speakers.map((speaker) => (
              <div className="speaker" key={speaker.id}>
                <input
                  value={speaker.name}
                  onChange={(e) =>
                    setSpeakers((all) =>
                      all.map((s) => (s.id === speaker.id ? { ...s, name: e.target.value } : s)),
                    )
                  }
                />
                <select
                  value={speaker.voice_id}
                  onChange={(e) =>
                    setSpeakers((all) =>
                      all.map((s) => (s.id === speaker.id ? { ...s, voice_id: e.target.value } : s)),
                    )
                  }
                >
                  {voices.map((v) => (
                    <option value={v.id} key={v.id}>
                      {v.name} · {v.gender} · {v.accent}
                    </option>
                  ))}
                </select>
                <label>
                  Speed
                  <input
                    type="number"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speaker.speed}
                    onChange={(e) =>
                      setSpeakers((all) =>
                        all.map((s) => (s.id === speaker.id ? { ...s, speed: +e.target.value } : s)),
                      )
                    }
                  />
                </label>
                <button type="button" disabled={busy} onClick={() => preview("Hello, this is a preview of this voice.", speaker)}>
                  ▶ Test voice
                </button>
                <button type="button" className="danger" onClick={() => removeSpeaker(speaker.id)}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setSpeakers((all) => [
                  ...all,
                  { id: id(), name: "New speaker", voice_id: "af_heart", speed: 1 },
                ])
              }
            >
              + Add speaker
            </button>
          </section>

          <section className="panel">
            <h2>Timing</h2>
            <label>
              Speaker change pause
              <select value={pause} onChange={(e) => setPause(+e.target.value)}>
                {[1, 1.5, 2, 2.5, 3, 4].map((v) => (
                  <option value={v} key={v}>
                    {v} seconds
                  </option>
                ))}
              </select>
            </label>
            <p>Same-speaker turns get a short natural pause. Use <code>[pause:1s]</code> inside text for extra silence.</p>
          </section>

          {audioUrl && (
            <section className="panel player">
              <h2>Ready · {audioName || "conversation.wav"}</h2>
              <audio controls src={api.base + audioUrl} />
              <div className="download-row">
                <a className="primary download" href={api.base + audioUrl} download={audioName || "conversation.wav"}>
                  ↓ WAV
                </a>
                {mp3Url ? (
                  <a className="primary download" href={api.base + mp3Url} download={mp3Name || "conversation.mp3"}>
                    ↓ MP3
                  </a>
                ) : (
                  <button type="button" className="ghost" disabled>
                    MP3 unavailable
                  </button>
                )}
              </div>
            </section>
          )}

          <section className="panel history">
            <h2>History</h2>
            {!history.length && <p>Generated conversations will show up here.</p>}
            <div className="history-list">
              {history.map((item) => (
                <div className="history-item" key={item.id}>
                  <div>
                    <strong>{item.topic}</strong>
                    <span>
                      {item.filename}
                      {item.mp3_filename ? ` · ${item.mp3_filename}` : ""} · {item.messages} turns ·{" "}
                      {formatWhen(item.created_at)}
                    </span>
                  </div>
                  <div className="history-actions">
                    <a className="ghost link-btn" href={api.base + item.url} download={item.filename}>
                      WAV
                    </a>
                    {item.mp3_url && item.mp3_filename && (
                      <a className="ghost link-btn" href={api.base + item.mp3_url} download={item.mp3_filename}>
                        MP3
                      </a>
                    )}
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setAudioUrl(item.url);
                        setAudioName(item.filename);
                        setMp3Url(item.mp3_url || undefined);
                        setMp3Name(item.mp3_filename || undefined);
                        setTopic(item.topic);
                        setStatus(`Loaded “${item.topic}”`);
                      }}
                    >
                      Open
                    </button>
                    <button type="button" className="danger" onClick={() => deleteHistoryItem(item)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
