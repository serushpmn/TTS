import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "./api";
import { CHAT_THEMES, loadChatTheme, saveChatTheme, type ChatTheme } from "./bubbles";
import { AudioPlayer } from "./components/AudioPlayer";
import { Icon } from "./components/Icons";
import { ModelPanel } from "./components/ModelPanel";
import { ProjectsPanel } from "./components/ProjectsPanel";
import { PronunciationPanel } from "./components/PronunciationPanel";
import { VoicePicker } from "./components/VoicePicker";
import { engineLangConflict, exportBasename, filenameFromUrl } from "./delivery";
import { clearDraft, formatDuration, loadDraft, saveDraft } from "./draft";
import { estimateDialogueSeconds } from "./estimate";
import { isRtl, t, UI_LOCALES, type UiLocale } from "./i18n";
import { matchPausePreset, PAUSE_PRESETS, type PausePresetId } from "./pausePresets";
import { PROJECT_PROFILES, type ProjectProfileId } from "./projectProfiles";
import { applyAppearance, loadMode, type ModeId } from "./themes";
import type {
  AppMode,
  GenerateJob,
  HistoryItem,
  LecturePlan,
  Message,
  Project,
  Speaker,
  SynthLanguage,
  ToneStyle,
  Voice,
} from "./types";
import {
  allowedGendersFor,
  genderOf,
  hasMixedGenders,
  nextSpeakerDefaults,
  randomizeSpeakerVoices,
  randomVoiceForSpeaker,
} from "./voices";

const id = () => crypto.randomUUID();

function ssmlActions(locale: UiLocale): { label: string; tag: string; title: string }[] {
  return [
    { label: t(locale, "tagShortPause"), tag: "[pause:0.4s]", title: t(locale, "tagShortPause") },
    { label: t(locale, "tagPause"), tag: "[pause]", title: t(locale, "tagPause") },
    { label: t(locale, "tagLongPause"), tag: "[pause:1.5s]", title: t(locale, "tagLongPause") },
    { label: t(locale, "tagLaugh"), tag: "[laugh]", title: t(locale, "tagLaugh") },
    { label: t(locale, "tagSlow"), tag: "[slow]", title: t(locale, "tagSlow") },
  ];
}

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
    tone_id: item.tone_id || null,
  }));
}

function normalizeLocale(value: string | null | undefined): UiLocale {
  if (value === "fa" || value === "de" || value === "en") return value;
  return "en";
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
  const [tones, setTones] = useState<ToneStyle[]>([]);
  const [languages, setLanguages] = useState<SynthLanguage[]>([]);
  const [uiLocale, setUiLocale] = useState<UiLocale>("en");
  const [toneId, setToneId] = useState("neutral");
  const [synthLang, setSynthLang] = useState("auto");
  const [strictCast, setStrictCast] = useState(true);
  const [dirtyMessageIds, setDirtyMessageIds] = useState<Set<string>>(() => new Set());
  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  const [activeProfile, setActiveProfile] = useState<ProjectProfileId | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const audioReadyRef = useRef(false);
  const pausePreset = matchPausePreset(pause, sameSpeakerPause);
  const tx = (key: string) => t(uiLocale, key);
  const tagActions = useMemo(() => ssmlActions(uiLocale), [uiLocale]);

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
    document.documentElement.lang = uiLocale;
    document.documentElement.dir = isRtl(uiLocale) ? "rtl" : "ltr";
  }, [uiLocale]);

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
    api.tones().then(setTones).catch(() => undefined);
    api.languages().then(setLanguages).catch(() => undefined);
    api
      .getPrefs()
      .then((prefs) => {
        setSelectedModelId(prefs.selected_model_id);
        setPlaybackRate(prefs.playback_rate || 1);
        setFavoriteVoices(prefs.favorite_voices || []);
        setDefaultVoiceId(prefs.default_voice_id || "af_heart");
        setTrimSilence(Boolean(prefs.trim_silence_default));
        setStrictCast(prefs.strict_cast !== false);
        setUiLocale(normalizeLocale(prefs.ui_locale));
        setSynthLang(prefs.synth_lang || "auto");
        setToneId(prefs.default_tone_id || "neutral");
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

  const updateMessage = (message: Message, patch: Partial<Message>) => {
    setMessages((items) => items.map((item) => (item.id === message.id ? { ...item, ...patch } : item)));
    if (audioReadyRef.current && ("text" in patch || "tone_id" in patch)) {
      setDirtyMessageIds((prev) => {
        const next = new Set(prev);
        next.add(message.id);
        return next;
      });
    }
  };

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
    messages: messages.map((item) => ({
      ...item,
      tone_id: item.tone_id || toneId,
    })),
    speaker_change_pause: pause,
    same_speaker_pause: sameSpeakerPause,
    trim_silence: trimSilence,
    tone_id: toneId,
    synth_lang: synthLang,
    lecture_text: lectureText,
    narrator_voice: narratorVoice,
    narrator_speed: narratorSpeed,
    section_pause: sectionPause,
    model_id: selectedModelId,
    audio_url: audioUrl,
  });

  async function persistLocale(locale: UiLocale) {
    setUiLocale(locale);
    try {
      await api.savePrefs({ ui_locale: locale });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function persistTone(next: string) {
    setToneId(next);
    try {
      await api.savePrefs({ default_tone_id: next });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function persistSynthLang(next: string) {
    setSynthLang(next);
    try {
      await api.savePrefs({ synth_lang: next });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function persistStrictCast(next: boolean) {
    setStrictCast(next);
    try {
      await api.savePrefs({ strict_cast: next });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function deliveryConflict(): string | null {
    return engineLangConflict(selectedModelId, synthLang, languages);
  }

  async function copyText(value: string, okKey: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(tx(okKey));
    } catch {
      setError("Clipboard unavailable");
    }
  }

  async function copyAudioPath(url: string | undefined) {
    const name = filenameFromUrl(url);
    if (!name) return;
    try {
      const result = await api.audioLocalPath(name);
      await copyText(result.path, "pathCopied");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function applyPausePreset(id: PausePresetId) {
    const preset = PAUSE_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setPause(preset.speakerChange);
    setSameSpeakerPause(preset.sameSpeaker);
    setSectionPause(preset.section);
  }

  function applyProjectProfile(profileId: ProjectProfileId) {
    const profile = PROJECT_PROFILES.find((item) => item.id === profileId);
    if (!profile) return;
    setAppMode(profile.mode);
    applyPausePreset(profile.pausePreset);
    setTrimSilence(profile.trimSilence);
    void api.savePrefs({ trim_silence_default: profile.trimSilence }).catch(() => undefined);
    void persistTone(profile.toneId);
    setActiveProfile(profile.id);
    setStatus(`${tx("profileApplied")}: ${tx(profile.labelKey)}`);
  }

  async function playToneSample(toneSampleId: string) {
    const conflict = deliveryConflict();
    if (conflict) {
      setError(conflict);
      return;
    }
    try {
      setError("");
      const existing = tones.find((item) => item.id === toneSampleId)?.sample_url;
      let url = existing || null;
      if (!url) {
        const voice =
          appMode === "lecture"
            ? narratorVoice
            : speakers[0]?.voice_id || defaultVoiceId || "af_heart";
        const result = await api.toneSample(toneSampleId, voice);
        url = result.url;
        setTones((items) =>
          items.map((item) => (item.id === toneSampleId ? { ...item, sample_url: result.url } : item)),
        );
      }
      new Audio(api.base + url).play();
      void persistTone(toneSampleId);
    } catch (e) {
      setError((e as Error).message);
    }
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
      setStatus(`${tx("defaultVoice")}: ${id}`);
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
    setToneId(project.tone_id || toneId);
    setSynthLang(project.synth_lang || synthLang);
    setLectureText(project.lecture_text || "");
    setNarratorVoice(project.narrator_voice || defaultVoiceId || "af_heart");
    setNarratorSpeed(project.narrator_speed ?? 1);
    setSectionPause(project.section_pause ?? 0.85);
    if (project.model_id) setSelectedModelId(project.model_id);
    setAudioUrl(project.audio_url || undefined);
    audioReadyRef.current = Boolean(project.audio_url);
    setDirtyMessageIds(new Set());
    setActiveProfile(null);
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
    setDirtyMessageIds(new Set());
    setRegenIndex(null);
    setActiveProfile(null);
    audioReadyRef.current = false;
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
      setStatus(tx("cancelled"));
      return;
    }
    if (latest.status === "error") throw new Error(latest.error || "Generation failed");
    setAudioUrl(latest.url || undefined);
    setAudioName(latest.filename || undefined);
    setMp3Url(latest.mp3_url || undefined);
    setMp3Name(latest.mp3_filename || undefined);
    audioReadyRef.current = Boolean(latest.url);
    setDirtyMessageIds(new Set());
    setRegenIndex(null);
    setStatus(tx("ready"));
    await refreshHistory();
  }

  async function cancelGeneration() {
    const jobId = jobIdRef.current || job?.id;
    if (!jobId) return;
    try {
      const cancelled = await api.cancelGenerate(jobId);
      setJob(cancelled);
      setStatus(tx("cancelled"));
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
      setError(tx("keepOneSpeaker"));
      return;
    }
    if (strictCast && !hasMixedGenders(remaining, voices)) {
      setError(tx("cannotRemoveSpeaker"));
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

  async function preview(text: string, speaker: Speaker, messageTone?: string | null) {
    const conflict = deliveryConflict();
    if (conflict) {
      setError(conflict);
      return;
    }
    try {
      setError("");
      setBusy(true);
      const result = await api.preview({
        text,
        voice_id: speaker.voice_id,
        speed: speaker.speed,
        model_id: selectedModelId,
        tone_id: messageTone || toneId,
        synth_lang: synthLang,
      });
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
    const conflict = deliveryConflict();
    if (conflict) {
      setError(conflict);
      return;
    }
    try {
      setError("");
      setBusy(true);
      setRegenIndex(index);
      setStatus(`${tx("updatingMix")} (${index + 1})`);
      const result = await api.regenerateSegment({
        mode: "dialogue",
        index,
        text: message.text,
        voice_id: speaker.voice_id,
        speed: speaker.speed,
        model_id: selectedModelId,
        tone_id: message.tone_id || toneId,
        synth_lang: synthLang,
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
      audioReadyRef.current = true;
      setDirtyMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
      setStatus(tx("lineRegenerated"));
      await refreshHistory();
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
      setRegenIndex(null);
    }
  }

  async function generate() {
    if (!topic.trim()) {
      setError(tx("enterTopic"));
      return;
    }
    const conflict = deliveryConflict();
    if (conflict) {
      setError(conflict);
      return;
    }
    if (appMode === "lecture") {
      if (!lectureText.trim()) {
        setError(tx("pasteLectureFirst"));
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
          tone_id: toneId,
          synth_lang: synthLang,
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
      setError(tx("fillTurns"));
      return;
    }
    if (strictCast && !hasMixedGenders(speakers, voices)) {
      setError(tx("mixGenders"));
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
    if (strictCast && !hasMixedGenders(next, voices)) {
      setError(tx("mixGenders"));
      return;
    }
    setError("");
    setSpeakers(next);
  }

  function randomizeOne(speakerId: string) {
    const voice = randomVoiceForSpeaker(speakerId, speakers, voices, strictCast);
    if (!voice) {
      setError(strictCast ? "No alternate voice available while keeping a mixed cast." : "No alternate voice.");
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
    if (strictCast && !hasMixedGenders(next, voices)) {
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
    <main className={`app-shell locale-${uiLocale}`}>
      <header className="chrome">
        <div className="chrome-top">
          <div className="brand-block">
            <p className="eyebrow">{tx("brandEyebrow")}</p>
            <h1>{tx("brandTitle")}</h1>
          </div>

          <div className="mode-switch" role="tablist" aria-label="App mode">
            <button
              type="button"
              className={appMode === "dialogue" ? "active" : ""}
              onClick={() => setAppMode("dialogue")}
            >
              {tx("modeDialogue")}
            </button>
            <button
              type="button"
              className={appMode === "lecture" ? "active" : ""}
              onClick={() => setAppMode("lecture")}
            >
              {tx("modeLecture")}
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
                {tx("cancel")}
              </button>
            ) : (
              <button className="primary generate-btn" disabled={busy} onClick={generate}>
                {tx("generate")}
              </button>
            )}
          </div>
        </div>

        <div className="chrome-tools">
          <label className="topic-field">
            <span>{tx("topic")}</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={tx("topicPlaceholder")}
              aria-label={tx("topic")}
            />
          </label>

          <div className="locale-switch" role="group" aria-label={tx("uiLanguage")}>
            {UI_LOCALES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={uiLocale === item.id ? "active" : ""}
                onClick={() => void persistLocale(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="tool-row">
            <ActionButton
              label={mode === "day" ? tx("night") : tx("day")}
              onClick={() => setMode((value) => (value === "day" ? "night" : "day"))}
            >
              <Icon name={mode === "day" ? "moon" : "sun"} />
            </ActionButton>
            <ActionButton label={tx("guide")} active={showHelp} onClick={() => setShowHelp((value) => !value)}>
              <Icon name="help" />
            </ActionButton>
            {appMode === "dialogue" && (
              <ActionButton label={tx("import")} active={panel === "import"} onClick={() => togglePanel("import")}>
                <Icon name="import" />
              </ActionButton>
            )}
            <ActionButton label={tx("history")} active={panel === "history"} onClick={() => togglePanel("history")}>
              <Icon name="history" />
            </ActionButton>
            <ActionButton label={tx("models")} active={panel === "models"} onClick={() => togglePanel("models")}>
              <Icon name="model" />
            </ActionButton>
            <ActionButton label={tx("projects")} active={panel === "projects"} onClick={() => togglePanel("projects")}>
              <Icon name="project" />
            </ActionButton>
            <ActionButton
              label={tx("voices")}
              active={panel === "voices"}
              onClick={() => {
                setVoiceTarget(appMode === "lecture" ? "narrator" : speakers[0]?.id || "narrator");
                togglePanel("voices");
              }}
            >
              <Icon name="play" />
            </ActionButton>
            <ActionButton label={tx("dict")} active={panel === "pronounce"} onClick={() => togglePanel("pronounce")}>
              <Icon name="help" />
            </ActionButton>
            <ActionButton label={tx("reset")} onClick={resetAll}>
              <Icon name="reset" />
            </ActionButton>
          </div>
        </div>
      </header>

      <section className="delivery-bar" aria-label={tx("tone")}>
        <div className="profile-row" role="group" aria-label={tx("profiles")}>
          <span className="delivery-label">{tx("profiles")}</span>
          {PROJECT_PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={activeProfile === profile.id ? "active" : ""}
              title={tx(profile.hintKey)}
              onClick={() => applyProjectProfile(profile.id)}
            >
              {tx(profile.labelKey)}
            </button>
          ))}
        </div>
        <div className="tone-row">
          <span className="delivery-label" title={tx("toneHint")}>
            {tx("tone")}
          </span>
          <div className="tone-chips" role="group" aria-label={tx("tone")}>
            {tones.map((tone) => (
              <span key={tone.id} className={`tone-chip-wrap ${toneId === tone.id ? "active" : ""}`}>
                <button
                  type="button"
                  className={toneId === tone.id ? "active" : ""}
                  title={tone.description}
                  onClick={() => void persistTone(tone.id)}
                >
                  {tone.label}
                </button>
                <button
                  type="button"
                  className="tone-sample-btn"
                  title={tx("playToneSample")}
                  aria-label={`${tx("playToneSample")}: ${tone.label}`}
                  disabled={busy}
                  onClick={() => void playToneSample(tone.id)}
                >
                  ▶
                </button>
              </span>
            ))}
          </div>
        </div>
        <label className="pause-inline synth-lang-field" title={tx("synthLangHint")}>
          {tx("synthLang")}
          <select value={synthLang} onChange={(e) => void persistSynthLang(e.target.value)}>
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
                {lang.status === "experimental" ? ` (${tx("experimental")})` : ""}
              </option>
            ))}
          </select>
        </label>
        {(() => {
          const warn = deliveryConflict();
          return warn ? (
            <p className="delivery-warn" role="status">
              {warn}
            </p>
          ) : null;
        })()}
      </section>

      {appMode === "dialogue" ? (
      <section className={`speaker-bar ${speakersCompact ? "compact" : ""}`}>
        <div className="speaker-bar-head">
          <span>{tx("speakers")}</span>
          <div className="speaker-bar-actions">
            {chatBusy && (
              <button type="button" onClick={() => setSpeakersExpanded((value) => !value)}>
                {speakersCompact ? tx("expand") : tx("compact")}
              </button>
            )}
            <div className="pause-presets" role="group" aria-label={tx("pausePresets")}>
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
              {tx("changePause")}
              <select value={pause} onChange={(e) => setPause(+e.target.value)}>
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((v) => (
                  <option value={v} key={v}>
                    {v}s
                  </option>
                ))}
              </select>
            </label>
            <label className="pause-inline" title="Pause between same-speaker lines">
              {tx("samePause")}
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
              {tx("trimSilence")}
            </label>
            <label className="check-inline" title={tx("strictCastHint")}>
              <input
                type="checkbox"
                checked={strictCast}
                onChange={(e) => void persistStrictCast(e.target.checked)}
              />
              {tx("strictCast")}
            </label>
            {!speakersCompact && (
              <>
                <button type="button" disabled={!voices.length || speakers.length < 2} onClick={randomizeAll}>
                  <Icon name="random" /> {tx("randomMix")}
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
                  <Icon name="add" /> {tx("addSpeaker")}
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
                  {voices.find((v) => v.id === speaker.voice_id)?.name || speaker.voice_id} · {tx("pickVoice")}
                </button>
                <div className="speaker-card-foot">
                  <span>{genderOf(speaker.voice_id, voices)}</span>
                  <input
                    type="number"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speaker.speed}
                    title={tx("speed")}
                    aria-label={tx("speed")}
                    onChange={(e) =>
                      setSpeakers((all) =>
                        all.map((s) => (s.id === speaker.id ? { ...s, speed: +e.target.value } : s)),
                      )
                    }
                  />
                  <ActionButton label={tx("random")} onClick={() => randomizeOne(speaker.id)} disabled={!voices.length}>
                    <Icon name="random" />
                  </ActionButton>
                  <ActionButton
                    label={tx("test")}
                    disabled={busy}
                    onClick={() => preview("Hello, this is a preview of this voice.", speaker)}
                  >
                    <Icon name="play" />
                  </ActionButton>
                  <ActionButton label={tx("remove")} variant="danger" onClick={() => removeSpeaker(speaker.id)}>
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
          <span>{tx("narrator")}</span>
          <div className="speaker-bar-actions">
            <div className="pause-presets" role="group" aria-label={tx("pausePresets")}>
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
              {tx("sectionPause")}
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
              {tx("trimSilence")}
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
            {voices.find((v) => v.id === narratorVoice)?.name || narratorVoice} · {tx("pickNarrator")}
          </button>
          <label className="pause-inline">
            {tx("speed")}
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
            label={tx("testVoice")}
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
        <p className="hint">{appMode === "lecture" ? tx("helpLecture") : tx("helpDialogue")}</p>
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
            <Icon name="stop" /> {tx("stopGeneration")}
          </button>
        </section>
      )}

      <div className="workspace">
        {appMode === "dialogue" ? (
        <section className={`chat-pane chat-theme-${chatTheme}`}>
          <div className="section-heading chat-toolbar">
            <div className="chat-toolbar-left">
              <h2>{tx("chat")}</h2>
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
                      tone_id: toneId,
                    },
                  ]);
                }}
              >
                + {tx("addMessage")}
              </button>
            </div>
          </div>

          <div className="chat">
            {chatEmpty && (
              <div className="empty-state chat-empty">
                <strong>{tx("startConversation")}</strong>
                <p>{tx("startConversationHint")}</p>
              </div>
            )}
            {messages.map((message, index) => {
              const speaker = speakerById.get(message.speaker_id);
              const side = speakerSide.get(message.speaker_id) || "left";
              const active = activeMessageId === message.id;
              const messageTone = message.tone_id || toneId;
              const isDirty = dirtyMessageIds.has(message.id);
              const isRegening = regenIndex === index;
              return (
                <article
                  className={`bubble-row ${side} ${active ? "active" : ""} ${isDirty ? "needs-regen" : ""} ${isRegening ? "regen-busy" : ""}`}
                  key={message.id}
                >
                  <div className="bubble-stack">
                    <div className="bubble-meta">
                      <label className="bubble-speaker">
                        <select
                          value={message.speaker_id}
                          aria-label={tx("speakers")}
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
                      {tones.length > 0 && (
                        <label className="bubble-tone">
                          <select
                            value={messageTone}
                            aria-label={tx("tone")}
                            title={tx("toneHint")}
                            onChange={(e) => updateMessage(message, { tone_id: e.target.value })}
                            onFocus={() => setActiveMessageId(message.id)}
                          >
                            {tones.map((tone) => (
                              <option key={tone.id} value={tone.id}>
                                {tone.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {isDirty && <span className="edited-badge">{tx("lineEdited")}</span>}
                    </div>
                    <div className={`bubble ${side}`}>
                      <AutoTextarea
                        className="bubble-input"
                        value={message.text}
                        placeholder={tx("messagePlaceholder")}
                        onFocus={() => setActiveMessageId(message.id)}
                        onChange={(value) => updateMessage(message, { text: value })}
                      />
                      <div className="bubble-actions">
                        <button
                          type="button"
                          title={tx("preview")}
                          disabled={!message.text.trim() || !speaker || busy}
                          onClick={() => speaker && preview(message.text, speaker, message.tone_id || toneId)}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          className={isDirty ? "regen-needed" : ""}
                          title={tx("regenHint")}
                          disabled={!message.text.trim() || !speaker || busy || !topic.trim()}
                          onClick={() => void regenerateMessage(message, index)}
                        >
                          {isRegening ? "…" : "↻"}
                        </button>
                        <button type="button" title={tx("moveUp")} onClick={() => move(index, -1)}>
                          ↑
                        </button>
                        <button type="button" title={tx("moveDown")} onClick={() => move(index, 1)}>
                          ↓
                        </button>
                        <button
                          type="button"
                          title={tx("duplicate")}
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
                          title={tx("delete")}
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

          <div className="chat-compose-bar" aria-label={tx("insertTags")}>
            {tagActions.map((action) => (
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
            <h2>{tx("lectureScript")}</h2>
            <span className="plan-meta">
              {lecturePlan
                ? `${lecturePlan.count} sections · ${formatDuration(lecturePlan.estimated_seconds ?? Math.max(1, Math.round(lecturePlan.characters / 13.5)))}`
                : tx("pasteLecturePlaceholder")}
            </span>
          </div>
          {lectureEmpty && (
            <div className="empty-state">
              <strong>{tx("pasteLecture")}</strong>
              <p>{tx("pasteLectureHint")}</p>
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
              <strong>{tx("sectionsPreview")}</strong>
              <ol>
                {lecturePlan.chunks.slice(0, 8).map((chunk, index) => (
                  <li key={`${index}-${chunk.slice(0, 24)}`}>
                    {chunk.length > 140 ? `${chunk.slice(0, 140)}…` : chunk}
                  </li>
                ))}
              </ol>
              {lecturePlan.count > 8 && (
                <p className="muted">
                  +{lecturePlan.count - 8} {tx("moreSections")}
                </p>
              )}
            </div>
          )}
          <div className="chat-compose-bar" aria-label={tx("insertTags")}>
            {tagActions.map((action) => (
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
                <h2>{audioName || tx("ready")}</h2>
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
                <a
                  className="primary download"
                  href={api.base + audioUrl}
                  download={`${exportBasename(topic || audioName || "conversation")}.wav`}
                  title={tx("downloadWav")}
                >
                  WAV
                </a>
                {mp3Url && (
                  <a
                    className="primary download"
                    href={api.base + mp3Url}
                    download={`${exportBasename(topic || mp3Name || "conversation")}.mp3`}
                    title={tx("downloadMp3")}
                  >
                    MP3
                  </a>
                )}
              </div>
              <div className="export-actions">
                <button type="button" className="quiet-btn" onClick={() => void copyAudioPath(audioUrl)}>
                  {tx("copyPath")}
                </button>
                <button
                  type="button"
                  className="quiet-btn"
                  onClick={() => void copyText(api.base + audioUrl, "urlCopied")}
                >
                  {tx("copyUrl")}
                </button>
                {mp3Url && (
                  <button type="button" className="quiet-btn" onClick={() => void copyAudioPath(mp3Url)}>
                    {tx("copyPath")} MP3
                  </button>
                )}
              </div>
            </section>
          ) : (
            <section className="panel empty-side">
              <div className="audio-sphere" aria-hidden="true" />
              <p>{tx("generateEmpty")}</p>
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
                  ? tx("import")
                  : panel === "history"
                    ? tx("history")
                    : panel === "models"
                      ? tx("models")
                      : panel === "projects"
                        ? tx("projects")
                        : panel === "voices"
                          ? tx("voices")
                          : tx("dict")}
              </h2>
              <ActionButton label="Close" onClick={() => setPanel(null)}>
                <Icon name="close" />
              </ActionButton>
            </div>

            {panel === "import" && (
              <form className="drawer-body" onSubmit={importConversation}>
                <p className="muted import-hint">{tx("importHint")}</p>
                <AutoTextarea
                  value={importText}
                  onChange={setImportText}
                  placeholder={
                    "Sarah: Hello\nJohn: Hi there\n\n# or SRT / CSV / [Sarah] Hello / - Alex: Hey"
                  }
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
                          audioReadyRef.current = true;
                          setDirtyMessageIds(new Set());
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
                    voiceTarget === "narrator" || !strictCast
                      ? undefined
                      : allowedGendersFor(voiceTarget, speakers, voices, strictCast)
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
