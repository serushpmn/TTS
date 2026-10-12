import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "./api";
import { applyAppearance, loadMode, type ModeId } from "./themes";
import type { AppMode, GenerateJob, HistoryItem, LecturePlan, Message, Project, Speaker, Voice } from "./types";
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

function Icon({ name }: { name: "sun" | "moon" | "help" | "import" | "history" | "reset" | "play" | "random" | "close" | "add" }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
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
  }
}

function ActionButton({
  label,
  active,
  onClick,
  children,
  disabled,
  variant = "ghost",
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  variant?: "ghost" | "primary" | "danger";
}) {
  return (
    <button
      type="button"
      className={`action-btn ${variant} ${active ? "active" : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      <span>{label}</span>
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
  const [mode, setMode] = useState<ModeId>(() => loadMode());
  const [panel, setPanel] = useState<PanelId>(null);
  const [appMode, setAppMode] = useState<AppMode>("dialogue");
  const [lectureText, setLectureText] = useState("");
  const [narratorVoice, setNarratorVoice] = useState("af_heart");
  const [narratorSpeed, setNarratorSpeed] = useState(1);
  const [sectionPause, setSectionPause] = useState(0.85);
  const [lecturePlan, setLecturePlan] = useState<LecturePlan | null>(null);

  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const speakerSide = useMemo(() => {
    const map = new Map<string, "left" | "right">();
    speakers.forEach((speaker, index) => map.set(speaker.id, index % 2 === 0 ? "left" : "right"));
    return map;
  }, [speakers]);

  useEffect(() => {
    applyAppearance("studio", mode);
  }, [mode]);

  useEffect(() => {
    api.voices().then((list) => {
      setVoices(list);
      if (list.length && !list.some((voice) => voice.id === narratorVoice)) {
        setNarratorVoice(list[0].id);
      }
    }).catch((e) => setError(e.message));
    refreshHistory().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (appMode !== "lecture" || !lectureText.trim()) {
      setLecturePlan(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .lecturePlan(lectureText)
        .then(setLecturePlan)
        .catch(() => setLecturePlan(null));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [lectureText, appMode]);

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
    setLectureText("");
    setLecturePlan(null);
    setNarratorVoice("af_heart");
    setNarratorSpeed(1);
    setSectionPause(0.85);
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

  async function pollJob(started: GenerateJob) {
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
    if (!topic.trim()) {
      setError("Enter a topic for the file name.");
      return;
    }
    if (appMode === "lecture") {
      if (!lectureText.trim()) {
        setError("Paste your lecture or presentation script first.");
        return;
      }
      try {
        setError("");
        setBusy(true);
        setStatus("");
        const started = await api.startLecture({
          text: lectureText,
          topic: topic.trim(),
          voice_id: narratorVoice,
          speed: narratorSpeed,
          section_pause: sectionPause,
        });
        await pollJob(started);
      } catch (e) {
        setError((e as Error).message);
        setStatus("");
      } finally {
        setBusy(false);
      }
      return;
    }

    const empty = messages.find((message) => !message.text.trim());
    if (empty) {
      setError("Fill in every dialogue turn before generating.");
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
      await pollJob(started);
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
      <header className="chrome">
        <div className="chrome-top">
          <div className="brand-block">
            <p className="eyebrow">Local · Private · Kokoro</p>
            <h1>Dialogue Studio</h1>
          </div>

          <div className="mode-switch" role="tablist" aria-label="App mode">
            <button
              type="button"
              className={appMode === "dialogue" ? "active" : ""}
              onClick={() => setAppMode("dialogue")}
            >
              Dialogue
            </button>
            <button
              type="button"
              className={appMode === "lecture" ? "active" : ""}
              onClick={() => setAppMode("lecture")}
            >
              Lecture
            </button>
          </div>

          <button className="primary generate-btn" disabled={busy} onClick={generate}>
            Generate audio
          </button>
        </div>

        <div className="chrome-tools">
          <label className="topic-field">
            <span>Topic / file name</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Morning meeting"
              aria-label="Topic"
            />
          </label>

          <div className="tool-row">
            <ActionButton
              label={mode === "day" ? "Night" : "Day"}
              onClick={() => setMode((value) => (value === "day" ? "night" : "day"))}
            >
              <Icon name={mode === "day" ? "moon" : "sun"} />
            </ActionButton>
            <ActionButton label="Guide" active={showHelp} onClick={() => setShowHelp((value) => !value)}>
              <Icon name="help" />
            </ActionButton>
            {appMode === "dialogue" && (
              <ActionButton label="Import" active={panel === "import"} onClick={() => togglePanel("import")}>
                <Icon name="import" />
              </ActionButton>
            )}
            <ActionButton label="History" active={panel === "history"} onClick={() => togglePanel("history")}>
              <Icon name="history" />
            </ActionButton>
            <ActionButton label="Reset" onClick={resetAll}>
              <Icon name="reset" />
            </ActionButton>
          </div>
        </div>
      </header>

      {appMode === "dialogue" ? (
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
              <Icon name="random" /> Random mix
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
              <Icon name="add" /> Add speaker
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
                    aria-label="Speed"
                    onChange={(e) =>
                      setSpeakers((all) =>
                        all.map((s) => (s.id === speaker.id ? { ...s, speed: +e.target.value } : s)),
                      )
                    }
                  />
                  <ActionButton label="Random" onClick={() => randomizeOne(speaker.id)} disabled={!voices.length}>
                    <Icon name="random" />
                  </ActionButton>
                  <ActionButton
                    label="Test"
                    disabled={busy}
                    onClick={() => preview("Hello, this is a preview of this voice.", speaker)}
                  >
                    <Icon name="play" />
                  </ActionButton>
                  <ActionButton label="Remove" variant="danger" onClick={() => removeSpeaker(speaker.id)}>
                    <Icon name="close" />
                  </ActionButton>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      ) : (
      <section className="speaker-bar narrator-bar">
        <div className="speaker-bar-head">
          <span>Narrator</span>
          <div className="speaker-bar-actions">
            <label className="pause-inline" title="Pause between sections">
              Section pause
              <select value={sectionPause} onChange={(e) => setSectionPause(+e.target.value)}>
                {[0.4, 0.6, 0.85, 1.2, 1.6, 2].map((v) => (
                  <option value={v} key={v}>
                    {v}s
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="narrator-row">
          <select value={narratorVoice} onChange={(e) => setNarratorVoice(e.target.value)} aria-label="Narrator voice">
            {voices.map((v) => (
              <option value={v.id} key={v.id}>
                {v.name} · {v.gender} · {v.accent}
              </option>
            ))}
          </select>
          <label className="pause-inline">
            Speed
            <input
              type="number"
              min="0.5"
              max="2"
              step="0.1"
              value={narratorSpeed}
              onChange={(e) => setNarratorSpeed(+e.target.value)}
            />
          </label>
          <ActionButton
            label="Test voice"
            disabled={busy || !voices.length}
            onClick={() =>
              preview("Welcome to this lecture. Today we will cover the main ideas clearly.", {
                id: "narrator",
                name: "Narrator",
                voice_id: narratorVoice,
                speed: narratorSpeed,
              })
            }
          >
            <Icon name="play" />
          </ActionButton>
          {lecturePlan && (
            <span className="plan-meta">
              {lecturePlan.count} sections · {lecturePlan.characters.toLocaleString()} chars
            </span>
          )}
        </div>
      </section>
      )}

      {showHelp && (
        <p className="hint">
          {appMode === "lecture" ? (
            <>
              Paste a long script. Blank lines become sections. Tags work too: <code>[pause]</code>,{" "}
              <code>[pause:1.5s]</code>, <code>[laugh]</code>.
            </>
          ) : (
            <>
              Use <code>[pause]</code>, <code>[pause:1.5s]</code>, <code>[laugh]</code>, <code>[sigh]</code> in text.
              Voices must stay mixed female + male.
            </>
          )}
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
        {appMode === "dialogue" ? (
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
        ) : (
        <section className="chat-pane lecture-pane">
          <div className="section-heading">
            <h2>Lecture script</h2>
            <span className="plan-meta">
              {lecturePlan
                ? `${lecturePlan.count} sections · ~${Math.max(1, Math.round(lecturePlan.characters / 14))}s spoken est.`
                : "Paste a long text"}
            </span>
          </div>
          <textarea
            className="lecture-editor"
            value={lectureText}
            onChange={(e) => setLectureText(e.target.value)}
            placeholder={
              "Paste your full lecture or presentation notes here.\n\n" +
              "Use a blank line between paragraphs/sections.\n\n" +
              "Example:\n\n" +
              "Welcome everyone. Today we cover three ideas.\n\n" +
              "First, the problem we are solving...\n\n" +
              "Second, the approach...\n\n" +
              "Finally, the takeaways. [pause:1s] Thank you."
            }
          />
          {lecturePlan && lecturePlan.count > 0 && (
            <div className="lecture-preview">
              <strong>Sections preview</strong>
              <ol>
                {lecturePlan.chunks.slice(0, 8).map((chunk, index) => (
                  <li key={`${index}-${chunk.slice(0, 24)}`}>
                    {chunk.length > 140 ? `${chunk.slice(0, 140)}…` : chunk}
                  </li>
                ))}
              </ol>
              {lecturePlan.count > 8 && <p className="muted">+{lecturePlan.count - 8} more sections</p>}
            </div>
          )}
        </section>
        )}

        <aside className="side-pane">
          {audioUrl ? (
            <section className="panel player">
              <div className="player-head">
                <div className="audio-sphere" aria-hidden="true" />
                <h2>{audioName || "Ready"}</h2>
              </div>
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
              <div className="audio-sphere" aria-hidden="true" />
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
              <ActionButton label="Close" onClick={() => setPanel(null)}>
                <Icon name="close" />
              </ActionButton>
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
