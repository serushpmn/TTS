import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "./api";
import { applyAppearance, loadMode, loadTheme, THEMES, type ModeId, type ThemeId } from "./themes";
import type { GenerateJob, HistoryItem, Message, Project, Speaker, Voice } from "./types";
import {
  allowedGendersFor,
  genderOf,
  hasMixedGenders,
  nextSpeakerDefaults,
  randomizeSpeakerVoices,
  randomVoiceForSpeaker,
} from "./voices";

const id = () => crypto.randomUUID();

function createSpeakers(): Speaker[] {
  return [
    { id: id(), name: "Sarah", voice_id: "af_heart", speed: 1 },
    { id: id(), name: "John", voice_id: "am_michael", speed: 1 },
  ];
}

function createMessages(speakers: Speaker[]): Message[] {
  return [
    { id: id(), speaker_id: speakers[0].id, text: "" },
    { id: id(), speaker_id: speakers[1].id, text: "" },
  ];
}

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

function IconButton({
  label,
  active,
  onClick,
  children,
  disabled,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? "active" : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
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
    el.style.height = `${Math.max(40, el.scrollHeight)}px`;
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

type PanelId = "import" | "history" | null;

export default function App() {
  const bootSpeakers = useMemo(() => createSpeakers(), []);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [speakers, setSpeakers] = useState(bootSpeakers);
  const [messages, setMessages] = useState(() => createMessages(bootSpeakers));
  const [pause, setPause] = useState(2.5);
  const [topic, setTopic] = useState("");
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
  const [showHelp, setShowHelp] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());
  const [mode, setMode] = useState<ModeId>(() => loadMode());
  const [panel, setPanel] = useState<PanelId>(null);

  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const speakerSide = useMemo(() => {
    const map = new Map<string, "left" | "right">();
    speakers.forEach((speaker, index) => map.set(speaker.id, index % 2 === 0 ? "left" : "right"));
    return map;
  }, [speakers]);

  useEffect(() => {
    applyAppearance(theme, mode);
  }, [theme, mode]);

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
    id: slugify(topic || "conversation"),
    name: topic || "conversation",
    topic: topic || "conversation",
    speakers,
    messages,
    speaker_change_pause: pause,
    audio_url: audioUrl,
  });

  function cycleTheme() {
    const index = THEMES.findIndex((item) => item.id === theme);
    const next = THEMES[(index + 1) % THEMES.length];
    setTheme(next.id);
    setStatus(`Theme: ${next.label}`);
  }

  function togglePanel(next: PanelId) {
    setPanel((current) => (current === next ? null : next));
  }

  function resetAll() {
    const fresh = createSpeakers();
    setSpeakers(fresh);
    setMessages(createMessages(fresh));
    setTopic("");
    setImportText("");
    setPause(2.5);
    setAudioUrl(undefined);
    setAudioName(undefined);
    setMp3Url(undefined);
    setMp3Name(undefined);
    setJob(null);
    setBusy(false);
    setError("");
    setStatus("");
    setPanel(null);
    setShowHelp(false);
  }

  function removeSpeaker(speakerId: string) {
    const remaining = speakers.filter((s) => s.id !== speakerId);
    if (!remaining.length) {
      setError("Keep at least one speaker.");
      return;
    }
    if (!hasMixedGenders(remaining, voices)) {
      setError("Cannot remove that speaker — cast must stay mixed female and male.");
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
      const result = await api.preview(text, speaker.voice_id, speaker.speed);
      new Audio(api.base + result.url).play();
    } catch (e) {
      setError((e as Error).message);
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
      setError("Enter a topic for the file name.");
      return;
    }
    if (!hasMixedGenders(speakers, voices)) {
      setError("Speakers must mix female and male voices.");
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
      setStatus("Ready");
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
      if (missing.length) {
        setError(`New speakers added — set their voices: ${missing.join(", ")}`);
        const additions = missing.map((name) => ({
          id: id(),
          name,
          voice_id: "af_heart",
          speed: 1,
        }));
        additions.forEach((s) => byName.set(s.name.toLowerCase(), s));
        setSpeakers([...speakers, ...additions]);
      }
      setMessages(
        parsed.map((p) => ({
          id: id(),
          speaker_id: byName.get(p.speaker_name.toLowerCase())!.id,
          text: p.text,
        })),
      );
      setImportText("");
      setPanel(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function changeSpeakerVoice(speakerId: string, voiceId: string) {
    const next = speakers.map((speaker) =>
      speaker.id === speakerId ? { ...speaker, voice_id: voiceId } : speaker,
    );
    if (!hasMixedGenders(next, voices)) {
      setError("Speakers must mix female and male voices.");
      return;
    }
    setError("");
    setSpeakers(next);
  }

  function randomizeOne(speakerId: string) {
    const voice = randomVoiceForSpeaker(speakerId, speakers, voices);
    if (!voice) {
      setError("No alternate voice available while keeping a mixed cast.");
      return;
    }
    changeSpeakerVoice(speakerId, voice.id);
  }

  function randomizeAll() {
    if (speakers.length < 2) {
      setError("Need at least two speakers.");
      return;
    }
    const next = randomizeSpeakerVoices(speakers, voices);
    if (!hasMixedGenders(next, voices)) {
      setError("Could not build a mixed female/male cast.");
      return;
    }
    setSpeakers(next);
    setError("");
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
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const generating = job?.status === "queued" || job?.status === "running";

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Dialogue Studio</h1>

        <input
          className="topic-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic / file name"
          aria-label="Topic"
        />

        <div className="toolbar">
          <IconButton
            label={mode === "day" ? "Night mode" : "Day mode"}
            onClick={() => setMode((value) => (value === "day" ? "night" : "day"))}
          >
            {mode === "day" ? "☾" : "☀"}
          </IconButton>
          <IconButton label={`Theme: ${theme} (click to change)`} onClick={cycleTheme}>
            ◈
          </IconButton>
          <IconButton label="Guide" active={showHelp} onClick={() => setShowHelp((value) => !value)}>
            ?
          </IconButton>
          <IconButton label="Import" active={panel === "import"} onClick={() => togglePanel("import")}>
            ↧
          </IconButton>
          <IconButton label="History" active={panel === "history"} onClick={() => togglePanel("history")}>
            ≡
          </IconButton>
          <IconButton label="Reset everything" onClick={resetAll}>
            ↺
          </IconButton>
          <button className="primary generate-btn" disabled={busy} onClick={generate}>
            Generate
          </button>
        </div>
      </header>

      <section className="speaker-bar">
        <div className="speaker-bar-head">
          <span>Speakers</span>
          <div className="speaker-bar-actions">
            <label className="pause-inline" title="Pause when speaker changes">
              Pause
              <select value={pause} onChange={(e) => setPause(+e.target.value)}>
                {[1, 1.5, 2, 2.5, 3, 4].map((v) => (
                  <option value={v} key={v}>
                    {v}s
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={!voices.length || speakers.length < 2} onClick={randomizeAll}>
              🎲 Mix
            </button>
            <button
              type="button"
              onClick={() => {
                const defaults = nextSpeakerDefaults(speakers, voices);
                setSpeakers((all) => [
                  ...all,
                  { id: id(), name: defaults.name, voice_id: defaults.voice_id, speed: 1 },
                ]);
              }}
            >
              +
            </button>
          </div>
        </div>
        <div className="speaker-cards">
          {speakers.map((speaker) => {
            const allowed = allowedGendersFor(speaker.id, speakers, voices);
            const voiceOptions = voices.filter((voice) =>
              allowed.includes(voice.gender as "Female" | "Male"),
            );
            return (
              <div className="speaker-card" key={speaker.id}>
                <input
                  value={speaker.name}
                  onChange={(e) =>
                    setSpeakers((all) =>
                      all.map((s) => (s.id === speaker.id ? { ...s, name: e.target.value } : s)),
                    )
                  }
                  aria-label="Speaker name"
                />
                <select
                  value={speaker.voice_id}
                  onChange={(e) => changeSpeakerVoice(speaker.id, e.target.value)}
                  aria-label="Voice"
                >
                  {voiceOptions.map((v) => (
                    <option value={v.id} key={v.id}>
                      {v.name} · {v.gender}
                    </option>
                  ))}
                </select>
                <div className="speaker-card-foot">
                  <span>{genderOf(speaker.voice_id, voices)}</span>
                  <input
                    type="number"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speaker.speed}
                    title="Speed"
                    onChange={(e) =>
                      setSpeakers((all) =>
                        all.map((s) => (s.id === speaker.id ? { ...s, speed: +e.target.value } : s)),
                      )
                    }
                  />
                  <IconButton label="Random voice" onClick={() => randomizeOne(speaker.id)} disabled={!voices.length}>
                    🎲
                  </IconButton>
                  <IconButton
                    label="Test voice"
                    disabled={busy}
                    onClick={() => preview("Hello, this is a preview of this voice.", speaker)}
                  >
                    ▶
                  </IconButton>
                  <IconButton label="Remove speaker" onClick={() => removeSpeaker(speaker.id)}>
                    ×
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {showHelp && (
        <p className="hint">
          Use <code>[pause]</code>, <code>[pause:1.5s]</code>, <code>[laugh]</code>, <code>[sigh]</code> in text.
          Voices must stay mixed female + male.
        </p>
      )}

      {error && (
        <div className="notice error">
          {error}
          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {generating && job && (
        <section className="progress-inline">
          <div className="progress-meta">
            <strong>{job.stage}</strong>
            <span>
              {formatEta(job.eta_seconds)} · {Math.round(job.percent)}%
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(job.percent, 4)}%` }} />
          </div>
        </section>
      )}

      <div className="workspace">
        <section className="chat-pane">
          <div className="section-heading">
            <h2>Chat</h2>
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
              + Message
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
                        <button type="button" title="Up" onClick={() => move(index, -1)}>
                          ↑
                        </button>
                        <button type="button" title="Down" onClick={() => move(index, 1)}>
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
                      placeholder="Write dialogue…"
                      onChange={(value) => updateMessage(message, { text: value })}
                    />
                    <button
                      type="button"
                      className="preview-btn"
                      disabled={!message.text.trim() || !speaker || busy}
                      onClick={() => speaker && preview(message.text, speaker)}
                    >
                      ▶
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="side-pane">
          {audioUrl ? (
            <section className="panel player">
              <h2>{audioName || "Ready"}</h2>
              <audio controls src={api.base + audioUrl} />
              <div className="download-row">
                <a className="primary download" href={api.base + audioUrl} download={audioName || "conversation.wav"}>
                  WAV
                </a>
                {mp3Url && (
                  <a className="primary download" href={api.base + mp3Url} download={mp3Name || "conversation.mp3"}>
                    MP3
                  </a>
                )}
              </div>
            </section>
          ) : (
            <section className="panel empty-side">
              <p>Generate to get WAV + MP3 here.</p>
            </section>
          )}
          {status && !generating && <div className="notice tight">{status}</div>}
        </aside>
      </div>

      {panel && (
        <div className="drawer-backdrop" onClick={() => setPanel(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>{panel === "import" ? "Import" : "History"}</h2>
              <IconButton label="Close" onClick={() => setPanel(null)}>
                ×
              </IconButton>
            </div>

            {panel === "import" && (
              <form className="drawer-body" onSubmit={importConversation}>
                <AutoTextarea
                  value={importText}
                  onChange={setImportText}
                  placeholder={"Sarah: Hello\nJohn: Hi there"}
                />
                <button type="submit" className="primary" disabled={busy || !importText.trim()}>
                  Parse into chat
                </button>
              </form>
            )}

            {panel === "history" && (
              <div className="drawer-body history-list">
                {!history.length && <p className="muted">No exports yet.</p>}
                {history.map((item) => (
                  <div className="history-item" key={item.id}>
                    <div>
                      <strong>{item.topic}</strong>
                      <span>{formatWhen(item.created_at)}</span>
                    </div>
                    <div className="history-actions">
                      <a className="link-btn" href={api.base + item.url} download={item.filename}>
                        WAV
                      </a>
                      {item.mp3_url && item.mp3_filename && (
                        <a className="link-btn" href={api.base + item.mp3_url} download={item.mp3_filename}>
                          MP3
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setAudioUrl(item.url);
                          setAudioName(item.filename);
                          setMp3Url(item.mp3_url || undefined);
                          setMp3Name(item.mp3_filename || undefined);
                          setTopic(item.topic);
                          setPanel(null);
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
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
