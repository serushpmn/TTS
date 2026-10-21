import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "./api";
import { CHAT_THEMES, loadChatTheme, saveChatTheme, type ChatTheme } from "./bubbles";
import { AudioPlayer } from "./components/AudioPlayer";
import { Icon } from "./components/Icons";
import { ModelPanel } from "./components/ModelPanel";
import { ProjectsPanel } from "./components/ProjectsPanel";
import { PronunciationPanel } from "./components/PronunciationPanel";
import { VoicePicker } from "./components/VoicePicker";
import { clearDraft, formatDuration, loadDraft, saveDraft } from "./draft";
import { estimateDialogueSeconds } from "./estimate";
import { matchPausePreset, PAUSE_PRESETS, type PausePresetId } from "./pausePresets";
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
const SSML_ACTIONS: { label: string; tag: string; title: string }[] = [
  { label: "مکث کوتاه", tag: "[pause:0.4s]", title: "Short pause" },
  { label: "مکث", tag: "[pause]", title: "Normal pause" },
  { label: "مکث بلند", tag: "[pause:1.5s]", title: "Long pause" },
  { label: "خنده", tag: "[laugh]", title: "Insert laugh (spoken approximation)" },
  { label: "آهسته", tag: "[slow]", title: "Speak slower from here" },
];

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

function sanitizeMessages(items: Message[]): Message[] {
  return items.map((item) => ({
    id: item.id,
    speaker_id: item.speaker_id,
    text: item.text,
  }));
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
  onFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
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
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

type PanelId = "import" | "history" | "models" | "projects" | "voices" | "pronounce" | null;

export default function App() {
  const restored = useMemo(() => loadDraft(), []);
  const bootSpeakers = useMemo(
    () => (restored?.speakers?.length ? restored.speakers : createSpeakers()),
    [restored],
  );
  const [voices, setVoices] = useState<Voice[]>([]);
  const [speakers, setSpeakers] = useState(bootSpeakers);
  const [messages, setMessages] = useState(() =>
    restored?.messages?.length ? sanitizeMessages(restored.messages) : createMessages(bootSpeakers),
  );
  const [chatTheme, setChatTheme] = useState<ChatTheme>(
    () => restored?.chatTheme || loadChatTheme(),
  );
  const [pause, setPause] = useState(restored?.pause ?? 2.5);
  const [sameSpeakerPause, setSameSpeakerPause] = useState(0.35);
  const [trimSilence, setTrimSilence] = useState(false);
  const [topic, setTopic] = useState(restored?.topic ?? "");
  const [importText, setImportText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string>();
  const [audioName, setAudioName] = useState<string>();
  const [mp3Url, setMp3Url] = useState<string>();
  const [mp3Name, setMp3Name] = useState<string>();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<GenerateJob | null>(null);
  const [status, setStatus] = useState(() => (restored ? "Draft restored" : ""));
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [mode, setMode] = useState<ModeId>(() => loadMode());
  const [panel, setPanel] = useState<PanelId>(null);
  const [appMode, setAppMode] = useState<AppMode>(restored?.appMode ?? "dialogue");
  const [lectureText, setLectureText] = useState(restored?.lectureText ?? "");
  const [narratorVoice, setNarratorVoice] = useState(restored?.narratorVoice ?? "af_heart");
  const [narratorSpeed, setNarratorSpeed] = useState(restored?.narratorSpeed ?? 1);
  const [sectionPause, setSectionPause] = useState(restored?.sectionPause ?? 0.85);
  const [lecturePlan, setLecturePlan] = useState<LecturePlan | null>(null);
  const [speakersExpanded, setSpeakersExpanded] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(restored?.selectedModelId ?? "kokoro-torch");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [favoriteVoices, setFavoriteVoices] = useState<string[]>([]);
  const [defaultVoiceId, setDefaultVoiceId] = useState("af_heart");
  const [voiceTarget, setVoiceTarget] = useState<"narrator" | string>("narrator");
  const jobIdRef = useRef<string | null>(null);
  const pausePreset = matchPausePreset(pause, sameSpeakerPause);

  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const speakerSide = useMemo(() => {
    const map = new Map<string, "left" | "right">();
    speakers.forEach((speaker, index) => map.set(speaker.id, index % 2 === 0 ? "left" : "right"));
    return map;
  }, [speakers]);

  useEffect(() => {
    applyAppearance("studio", mode);
  }, [mode]);

  function refreshVoices() {
    return api.voices().then((list) => {
      setVoices(list);
      if (list.length && !list.some((voice) => voice.id === narratorVoice)) {
        setNarratorVoice(list[0].id);
      }
      return list;
    });
  }

  useEffect(() => {
    refreshVoices().catch((e) => setError(e.message));
    refreshHistory().catch((e) => setError(e.message));
    api
      .getPrefs()
      .then((prefs) => {
        setSelectedModelId(prefs.selected_model_id);
        setPlaybackRate(prefs.playback_rate || 1);
        setFavoriteVoices(prefs.favorite_voices || []);
        setDefaultVoiceId(prefs.default_voice_id || "af_heart");
        setTrimSilence(Boolean(prefs.trim_silence_default));
        if (!restored?.narratorVoice && prefs.default_voice_id) {
          setNarratorVoice(prefs.default_voice_id);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    saveChatTheme(chatTheme);
  }, [chatTheme]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveDraft({
        appMode,
        topic,
        speakers,
        messages: sanitizeMessages(messages),
        pause,
        lectureText,
        narratorVoice,
        narratorSpeed,
        sectionPause,
        selectedModelId,
        chatTheme,
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [appMode, topic, speakers, messages, pause, lectureText, narratorVoice, narratorSpeed, sectionPause, selectedModelId, chatTheme]);

  useEffect(() => {
    if (appMode !== "lecture" || !lectureText.trim()) {
      setLecturePlan(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .lecturePlan(lectureText, narratorSpeed, sectionPause)
        .then(setLecturePlan)
        .catch(() => setLecturePlan(null));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [lectureText, appMode, narratorSpeed, sectionPause]);

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
    mode: appMode,
    speakers,
    messages,
    speaker_change_pause: pause,
    same_speaker_pause: sameSpeakerPause,
    trim_silence: trimSilence,
    lecture_text: lectureText,
    narrator_voice: narratorVoice,
    narrator_speed: narratorSpeed,
    section_pause: sectionPause,
    model_id: selectedModelId,
    audio_url: audioUrl,
  });

  function applyPausePreset(id: PausePresetId) {
    const preset = PAUSE_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setPause(preset.speakerChange);
    setSameSpeakerPause(preset.sameSpeaker);
    setSectionPause(preset.section);
  }

  async function persistFavorites(ids: string[]) {
    setFavoriteVoices(ids);
    try {
      await api.savePrefs({ favorite_voices: ids });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function persistDefaultVoice(id: string) {
    setDefaultVoiceId(id);
    try {
      await api.savePrefs({ default_voice_id: id });
      setStatus(`Default voice: ${id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function onVoicePicked(voiceId: string) {
    if (voiceTarget === "narrator") {
      setNarratorVoice(voiceId);
    } else {
      changeSpeakerVoice(voiceTarget, voiceId);
    }
  }

  function openProject(project: Project) {
    setAppMode(project.mode === "lecture" ? "lecture" : "dialogue");
    setTopic(project.topic || project.name);
    if (project.speakers?.length) setSpeakers(project.speakers);
    if (project.messages?.length) setMessages(sanitizeMessages(project.messages));
    setPause(project.speaker_change_pause ?? 2.5);
    setSameSpeakerPause(project.same_speaker_pause ?? 0.35);
    setTrimSilence(Boolean(project.trim_silence));
    setLectureText(project.lecture_text || "");
    setNarratorVoice(project.narrator_voice || defaultVoiceId || "af_heart");
    setNarratorSpeed(project.narrator_speed ?? 1);
    setSectionPause(project.section_pause ?? 0.85);
    if (project.model_id) setSelectedModelId(project.model_id);
    setAudioUrl(project.audio_url || undefined);
    setPanel(null);
    setStatus(`Opened “${project.name}”`);
  }

  function togglePanel(next: PanelId) {
    setPanel((current) => (current === next ? null : next));
  }

  function resetAll() {
    clearDraft();
    const fresh = createSpeakers();
    setSpeakers(fresh);
    setMessages(createMessages(fresh));
    setTopic("");
    setImportText("");
    setPause(2.5);
    setSameSpeakerPause(0.35);
    setTrimSilence(false);
    setLectureText("");
    setLecturePlan(null);
    setNarratorVoice(defaultVoiceId || "af_heart");
    setNarratorSpeed(1);
    setSectionPause(0.85);
    setAudioUrl(undefined);
    setAudioName(undefined);
    setMp3Url(undefined);
    setMp3Name(undefined);
    setJob(null);
    jobIdRef.current = null;
    setBusy(false);
    setError("");
    setStatus("");
    setPanel(null);
    setShowHelp(false);
    setSpeakersExpanded(false);
    setActiveMessageId(null);
  }

  async function pollJob(started: GenerateJob) {
    jobIdRef.current = started.id;
    setJob({ ...started, percent: 1, stage: "Queued…" });
    let latest = started;
    while (latest.status === "queued" || latest.status === "running") {
      await new Promise((resolve) => setTimeout(resolve, 450));
      latest = await api.generateStatus(started.id);
      setJob(latest);
    }
    jobIdRef.current = null;
    if (latest.status === "cancelled") {
      setStatus("Cancelled");
      return;
    }
    if (latest.status === "error") throw new Error(latest.error || "Generation failed");
    setAudioUrl(latest.url || undefined);
    setAudioName(latest.filename || undefined);
    setMp3Url(latest.mp3_url || undefined);
    setMp3Name(latest.mp3_filename || undefined);
    setStatus("Ready");
    await refreshHistory();
  }

  async function cancelGeneration() {
    const jobId = jobIdRef.current || job?.id;
    if (!jobId) return;
    try {
      const cancelled = await api.cancelGenerate(jobId);
      setJob(cancelled);
      setStatus("Cancelled");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function appendTagToText(text: string, tag: string) {
    if (!text) return tag;
    const needsSpace = !/\s$/.test(text);
    return `${text}${needsSpace ? " " : ""}${tag}`;
  }

  function insertTag(tag: string) {
    if (appMode === "lecture") {
      setLectureText((text) => appendTagToText(text, tag));
      return;
    }
    setMessages((items) => {
      if (!items.length) return items;
      const targetId = activeMessageId && items.some((item) => item.id === activeMessageId)
        ? activeMessageId
        : items[items.length - 1].id;
      return items.map((item) =>
        item.id === targetId ? { ...item, text: appendTagToText(item.text, tag) } : item,
      );
    });
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
      const result = await api.preview(text, speaker.voice_id, speaker.speed, selectedModelId);
      new Audio(api.base + result.url).play();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerateMessage(message: Message, index: number) {
    const speaker = speakerById.get(message.speaker_id);
    if (!speaker || !message.text.trim()) return;
    try {
      setError("");
      setBusy(true);
      setStatus(`Regenerating line ${index + 1}…`);
      const result = await api.regenerateSegment({
        mode: "dialogue",
        index,
        text: message.text,
        voice_id: speaker.voice_id,
        speed: speaker.speed,
        model_id: selectedModelId,
        messages,
        speakers,
        speaker_change_pause: pause,
        same_speaker_pause: sameSpeakerPause,
        trim_silence: trimSilence,
        topic: topic.trim() || "conversation",
      });
      setAudioUrl(result.url);
      setAudioName(result.filename);
      setMp3Url(result.mp3_url);
      setMp3Name(result.mp3_filename);
      setStatus("Line regenerated");
      await refreshHistory();
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
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
          trim_silence: trimSilence,
          model_id: selectedModelId,
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
  const chatEmpty = appMode === "dialogue" && messages.every((message) => !message.text.trim());
  const lectureEmpty = appMode === "lecture" && !lectureText.trim();
  const filledTurns = messages.filter((message) => message.text.trim()).length;
  const chatBusy = appMode === "dialogue" && (filledTurns >= 3 || messages.length >= 5);
  const speakersCompact = chatBusy && !speakersExpanded;
  const dialogueEstimate =
    appMode === "dialogue" && filledTurns > 0
      ? estimateDialogueSeconds(messages, speakers, pause)
      : null;
  const generateRef = useRef(generate);
  const cancelRef = useRef(cancelGeneration);
  generateRef.current = generate;
  cancelRef.current = cancelGeneration;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (event.key === "Escape") {
        if (generating) {
          event.preventDefault();
          void cancelRef.current();
          return;
        }
        if (panel) {
          setPanel(null);
          return;
        }
        if (showHelp) setShowHelp(false);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        if (busy) return;
        event.preventDefault();
        void generateRef.current();
        return;
      }

      if (!typing && event.key === "?" && !event.ctrlKey && !event.metaKey) {
        setShowHelp((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, generating, panel, showHelp]);

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

          <div className="generate-group">
            {appMode === "dialogue" && dialogueEstimate != null && !generating && (
              <span className="duration-estimate" title="Estimated audio length">
                {formatDuration(dialogueEstimate)}
              </span>
            )}
            {appMode === "lecture" && lecturePlan?.estimated_seconds != null && !generating && (
              <span className="duration-estimate" title="Estimated audio length">
                {formatDuration(lecturePlan.estimated_seconds)}
              </span>
            )}
            {generating ? (
              <button className="danger generate-btn" type="button" onClick={() => void cancelGeneration()}>
                Cancel
              </button>
            ) : (
              <button className="primary generate-btn" disabled={busy} onClick={generate}>
                Generate audio
              </button>
            )}
          </div>
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
            <ActionButton label="Models" active={panel === "models"} onClick={() => togglePanel("models")}>
              <Icon name="model" />
            </ActionButton>
            <ActionButton label="Projects" active={panel === "projects"} onClick={() => togglePanel("projects")}>
              <Icon name="project" />
            </ActionButton>
            <ActionButton
              label="Voices"
              active={panel === "voices"}
              onClick={() => {
                setVoiceTarget(appMode === "lecture" ? "narrator" : speakers[0]?.id || "narrator");
                togglePanel("voices");
              }}
            >
              <Icon name="play" />
            </ActionButton>
            <ActionButton label="Dict" active={panel === "pronounce"} onClick={() => togglePanel("pronounce")}>
              <Icon name="help" />
            </ActionButton>
            <ActionButton label="Reset" onClick={resetAll}>
              <Icon name="reset" />
            </ActionButton>
          </div>
        </div>
      </header>

      {appMode === "dialogue" ? (
      <section className={`speaker-bar ${speakersCompact ? "compact" : ""}`}>
        <div className="speaker-bar-head">
          <span>Speakers</span>
          <div className="speaker-bar-actions">
            {chatBusy && (
              <button type="button" onClick={() => setSpeakersExpanded((value) => !value)}>
                {speakersCompact ? "Expand" : "Compact"}
              </button>
            )}
            <div className="pause-presets" role="group" aria-label="Pause presets">
              {PAUSE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={pausePreset === preset.id ? "active" : ""}
                  onClick={() => applyPausePreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="pause-inline" title="Pause when speaker changes">
              Change
              <select value={pause} onChange={(e) => setPause(+e.target.value)}>
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((v) => (
                  <option value={v} key={v}>
                    {v}s
                  </option>
                ))}
              </select>
            </label>
            <label className="pause-inline" title="Pause between same-speaker lines">
              Same
              <select value={sameSpeakerPause} onChange={(e) => setSameSpeakerPause(+e.target.value)}>
                {[0, 0.2, 0.35, 0.5, 0.6, 0.8, 1].map((v) => (
                  <option value={v} key={v}>
                    {v}s
                  </option>
                ))}
              </select>
            </label>
            <label className="check-inline" title="Trim leading/trailing silence on each segment">
              <input
                type="checkbox"
                checked={trimSilence}
                onChange={(e) => {
                  setTrimSilence(e.target.checked);
                  void api.savePrefs({ trim_silence_default: e.target.checked }).catch(() => undefined);
                }}
              />
              Trim silence
            </label>
            {!speakersCompact && (
              <>
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
              </>
            )}
          </div>
        </div>
        {speakersCompact ? (
          <div className="speaker-compact-row">
            {speakers.map((speaker) => (
              <button
                type="button"
                className="speaker-chip"
                key={speaker.id}
                title={`${speaker.name} · ${speaker.voice_id}`}
                onClick={() => setSpeakersExpanded(true)}
              >
                <strong>{speaker.name}</strong>
                <span>{speaker.voice_id}</span>
              </button>
            ))}
          </div>
        ) : (
        <div className="speaker-cards">
          {speakers.map((speaker) => {
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
                <button
                  type="button"
                  className="voice-open-btn"
                  onClick={() => {
                    setVoiceTarget(speaker.id);
                    setPanel("voices");
                  }}
                >
                  {voices.find((v) => v.id === speaker.voice_id)?.name || speaker.voice_id} · pick
                </button>
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
        )}
      </section>
      ) : (
      <section className="speaker-bar narrator-bar">
        <div className="speaker-bar-head">
          <span>Narrator</span>
          <div className="speaker-bar-actions">
            <div className="pause-presets" role="group" aria-label="Pause presets">
              {PAUSE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={Math.abs(sectionPause - preset.section) < 0.05 ? "active" : ""}
                  onClick={() => applyPausePreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="pause-inline" title="Pause between sections">
              Section pause
              <select value={sectionPause} onChange={(e) => setSectionPause(+e.target.value)}>
                {[0.4, 0.6, 0.85, 1.2, 1.5, 1.6, 2].map((v) => (
                  <option value={v} key={v}>
                    {v}s
                  </option>
                ))}
              </select>
            </label>
            <label className="check-inline">
              <input
                type="checkbox"
                checked={trimSilence}
                onChange={(e) => {
                  setTrimSilence(e.target.checked);
                  void api.savePrefs({ trim_silence_default: e.target.checked }).catch(() => undefined);
                }}
              />
              Trim silence
            </label>
          </div>
        </div>
        <div className="narrator-row">
          <button
            type="button"
            className="voice-open-btn"
            onClick={() => {
              setVoiceTarget("narrator");
              setPanel("voices");
            }}
          >
            {voices.find((v) => v.id === narratorVoice)?.name || narratorVoice} · pick voice
          </button>
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
              {lecturePlan.estimated_seconds != null && (
                <> · {formatDuration(lecturePlan.estimated_seconds)}</>
              )}
            </span>
          )}
        </div>
      </section>
      )}

      {showHelp && (
        <p className="hint">
          {appMode === "lecture" ? (
            <>
              Paste a long script. Blank lines become sections. Tags: [pause], [pause:1.5s], [slow], [fast],
              [laugh]/[sigh] (spoken approximations, not recorded sound effects). Open Models to pick ONNX or
              PyTorch. Shortcuts: Ctrl+Enter generate, Esc cancel.
            </>
          ) : (
            <>
              Choose a chat theme once for the whole conversation. Tags: [pause], [pause:1.5s], [slow], [fast],
              [laugh]/[sigh] (spoken approximations). Use Models for ONNX variants; Projects to save/reopen.
              Ctrl+Enter generate, Esc cancel. ↻ regenerates one line.
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
          <button type="button" className="cancel-inline" onClick={() => void cancelGeneration()}>
            <Icon name="stop" /> Stop generation
          </button>
        </section>
      )}

      <div className="workspace">
        {appMode === "dialogue" ? (
        <section className={`chat-pane chat-theme-${chatTheme}`}>
          <div className="section-heading chat-toolbar">
            <div className="chat-toolbar-left">
              <h2>Chat</h2>
              <div className="chat-theme-switch" role="radiogroup" aria-label="Chat theme">
                {CHAT_THEMES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={chatTheme === option.id}
                    className={chatTheme === option.id ? "active" : ""}
                    onClick={() => setChatTheme(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="chat-heading-actions">
              {dialogueEstimate != null && (
                <span className="plan-meta">{formatDuration(dialogueEstimate)}</span>
              )}
              <button
                type="button"
                className="quiet-btn"
                onClick={() => {
                  const speakerId = speakers[messages.length % speakers.length]?.id || speakers[0]?.id || "";
                  setMessages([
                    ...messages,
                    {
                      id: id(),
                      speaker_id: speakerId,
                      text: "",
                    },
                  ]);
                }}
              >
                + Message
              </button>
            </div>
          </div>

          <div className="chat">
            {chatEmpty && (
              <div className="empty-state chat-empty">
                <strong>Start the conversation</strong>
                <p>Type in a bubble, or import a script. Ctrl+Enter when ready.</p>
              </div>
            )}
            {messages.map((message, index) => {
              const speaker = speakerById.get(message.speaker_id);
              const side = speakerSide.get(message.speaker_id) || "left";
              const active = activeMessageId === message.id;
              return (
                <article className={`bubble-row ${side} ${active ? "active" : ""}`} key={message.id}>
                  <div className="bubble-stack">
                    <label className="bubble-speaker">
                      <select
                        value={message.speaker_id}
                        aria-label="Speaker"
                        onChange={(e) => updateMessage(message, { speaker_id: e.target.value })}
                        onFocus={() => setActiveMessageId(message.id)}
                      >
                        {speakers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={`bubble ${side}`}>
                      <AutoTextarea
                        className="bubble-input"
                        value={message.text}
                        placeholder="Message"
                        onFocus={() => setActiveMessageId(message.id)}
                        onChange={(value) => updateMessage(message, { text: value })}
                      />
                      <div className="bubble-actions">
                        <button
                          type="button"
                          title="Preview"
                          disabled={!message.text.trim() || !speaker || busy}
                          onClick={() => speaker && preview(message.text, speaker)}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          title="Regenerate this line"
                          disabled={!message.text.trim() || !speaker || busy || !topic.trim()}
                          onClick={() => void regenerateMessage(message, index)}
                        >
                          ↻
                        </button>
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
                  </div>
                </article>
              );
            })}
          </div>

          <div className="chat-compose-bar" aria-label="Insert expression tags">
            {SSML_ACTIONS.map((action) => (
              <button
                key={action.tag}
                type="button"
                className="compose-chip"
                title={action.title}
                onClick={() => insertTag(action.tag)}
                disabled={busy}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
        ) : (
        <section className="chat-pane lecture-pane">
          <div className="section-heading">
            <h2>Lecture script</h2>
            <span className="plan-meta">
              {lecturePlan
                ? `${lecturePlan.count} sections · ${formatDuration(lecturePlan.estimated_seconds ?? Math.max(1, Math.round(lecturePlan.characters / 13.5)))}`
                : "Paste a long text"}
            </span>
          </div>
          {lectureEmpty && (
            <div className="empty-state">
              <strong>Paste your lecture</strong>
              <p>Blank lines become sections. Estimated duration updates as you type. Ctrl+Enter to generate.</p>
            </div>
          )}
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
          <div className="chat-compose-bar" aria-label="Insert expression tags">
            {SSML_ACTIONS.map((action) => (
              <button
                key={action.tag}
                type="button"
                className="compose-chip"
                title={action.title}
                onClick={() => insertTag(action.tag)}
                disabled={busy}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
        )}

        <aside className="side-pane">
          {audioUrl ? (
            <section className="panel player">
              <div className="player-head">
                <div className="audio-sphere" aria-hidden="true" />
                <h2>{audioName || "Ready"}</h2>
              </div>
              <AudioPlayer
                src={api.base + audioUrl}
                label={`Model: ${selectedModelId}`}
                playbackRate={playbackRate}
                onPlaybackRateChange={(rate) => {
                  setPlaybackRate(rate);
                  void api.savePrefs({ playback_rate: rate }).catch(() => undefined);
                }}
              />
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
              <p className="muted shortcut-hint">Ctrl+Enter · Esc to cancel</p>
              <p className="muted">Model: {selectedModelId}</p>
            </section>
          )}
          {status && !generating && <div className="notice tight">{status}</div>}
        </aside>
      </div>

      {panel && (
        <div className="drawer-backdrop" onClick={() => setPanel(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>
                {panel === "import"
                  ? "Import"
                  : panel === "history"
                    ? "History"
                    : panel === "models"
                      ? "Models"
                      : panel === "projects"
                        ? "Projects"
                        : panel === "voices"
                          ? "Voices"
                          : "Pronunciation"}
              </h2>
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
                      {item.model_id && <span className="muted"> · {item.model_id}</span>}
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
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          if (window.confirm(`Delete export “${item.topic}”?`)) void deleteHistoryItem(item);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {panel === "models" && (
              <ModelPanel
                selectedModelId={selectedModelId}
                onSelectedModelId={setSelectedModelId}
                onError={setError}
                onStatus={setStatus}
              />
            )}

            {panel === "projects" && (
              <ProjectsPanel
                current={makeProject()}
                onOpen={openProject}
                onError={setError}
                onStatus={setStatus}
              />
            )}

            {panel === "voices" && (
              <div className="drawer-body">
                <VoicePicker
                  voices={voices}
                  value={
                    voiceTarget === "narrator"
                      ? narratorVoice
                      : speakers.find((s) => s.id === voiceTarget)?.voice_id || narratorVoice
                  }
                  onChange={onVoicePicked}
                  favorites={favoriteVoices}
                  defaultVoiceId={defaultVoiceId}
                  onFavoritesChange={(ids) => void persistFavorites(ids)}
                  onDefaultVoiceChange={(id) => void persistDefaultVoice(id)}
                  onVoicesRefresh={() => void refreshVoices().catch((e) => setError(e.message))}
                  onError={setError}
                  onStatus={setStatus}
                  allowedGenders={
                    voiceTarget === "narrator"
                      ? undefined
                      : allowedGendersFor(voiceTarget, speakers, voices)
                  }
                />
              </div>
            )}

            {panel === "pronounce" && (
              <PronunciationPanel onError={setError} onStatus={setStatus} />
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
