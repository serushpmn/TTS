import { useMemo, useState } from "react";
import { api } from "../api";
import type { TranslateFn } from "../i18n";
import type { Voice } from "../types";
import { VoiceAvatar } from "./VoiceAvatar";

type Props = {
  voices: Voice[];
  value: string;
  onChange: (voiceId: string) => void;
  favorites: string[];
  defaultVoiceId: string;
  onFavoritesChange: (ids: string[]) => void;
  onDefaultVoiceChange: (id: string) => void;
  onVoicesRefresh: () => void;
  onError: (message: string) => void;
  onStatus: (message: string) => void;
  allowedGenders?: Array<"Female" | "Male">;
  compact?: boolean;
  t: TranslateFn;
};

export function VoicePicker({
  voices,
  value,
  onChange,
  favorites,
  defaultVoiceId,
  onFavoritesChange,
  onDefaultVoiceChange,
  onVoicesRefresh,
  onError,
  onStatus,
  allowedGenders,
  compact,
  t,
}: Props) {
  const [gender, setGender] = useState<"All" | "Female" | "Male">("All");
  const [accent, setAccent] = useState<string>("All");
  const [language, setLanguage] = useState<string>("All");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const accents = useMemo(
    () => ["All", ...Array.from(new Set(voices.map((v) => v.accent))).sort()],
    [voices],
  );
  const languages = useMemo(
    () => ["All", ...Array.from(new Set(voices.map((v) => v.language))).sort()],
    [voices],
  );

  const filtered = useMemo(() => {
    return voices.filter((voice) => {
      if (allowedGenders && !allowedGenders.includes(voice.gender as "Female" | "Male")) return false;
      if (gender !== "All" && voice.gender !== gender) return false;
      if (accent !== "All" && voice.accent !== accent) return false;
      if (language !== "All" && voice.language !== language) return false;
      if (onlyFavorites && !favorites.includes(voice.id)) return false;
      return true;
    });
  }, [voices, allowedGenders, gender, accent, language, onlyFavorites, favorites]);

  function playSample(voice: Voice) {
    if (!voice.sample_url) {
      onError(t("noSample", { name: voice.name }));
      return;
    }
    new Audio(api.base + voice.sample_url).play().catch((e) => onError(e.message));
  }

  function toggleFavorite(voiceId: string) {
    const next = favorites.includes(voiceId)
      ? favorites.filter((id) => id !== voiceId)
      : [...favorites, voiceId];
    onFavoritesChange(next);
  }

  function toggleCompare(voiceId: string) {
    setCompare((current) => {
      if (current.includes(voiceId)) return current.filter((id) => id !== voiceId);
      if (current.length >= 3) return [...current.slice(1), voiceId];
      return [...current, voiceId];
    });
  }

  async function generateMissing() {
    try {
      setBusy(true);
      onStatus(t("generatingSamples"));
      const result = await api.ensureAllVoiceSamples(false);
      const ok = result.results.filter((row) => row.ready).length;
      onStatus(t("samplesReady", { ok, count: result.count }));
      onVoicesRefresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generateOne(voiceId: string) {
    try {
      setBusy(true);
      await api.buildVoiceSample(voiceId, true);
      onStatus(t("sampleSaved", { id: voiceId }));
      onVoicesRefresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function labelAll(value: string) {
    return value === "All" ? t("filterAll") : value;
  }

  return (
    <div className={`voice-picker ${compact ? "compact" : ""}`}>
      <div className="voice-filters">
        <label>
          {t("filterGender")}
          <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
            <option value="All">{t("filterAll")}</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </select>
        </label>
        <label>
          {t("filterAccent")}
          <select value={accent} onChange={(e) => setAccent(e.target.value)}>
            {accents.map((item) => (
              <option key={item} value={item}>
                {labelAll(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("filterLanguage")}
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {languages.map((item) => (
              <option key={item} value={item}>
                {labelAll(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="check-inline">
          <input type="checkbox" checked={onlyFavorites} onChange={(e) => setOnlyFavorites(e.target.checked)} />
          {t("favoritesOnly")}
        </label>
        <button type="button" disabled={busy} onClick={() => void generateMissing()}>
          {t("bakeMissing")}
        </button>
      </div>

      <div className="voice-grid">
        {filtered.map((voice) => {
          const selected = voice.id === value;
          const fav = favorites.includes(voice.id);
          const inCompare = compare.includes(voice.id);
          return (
            <article key={voice.id} className={`voice-card ${selected ? "selected" : ""}`}>
              <button type="button" className="voice-select" onClick={() => onChange(voice.id)}>
                <VoiceAvatar gender={voice.gender} />
                <div>
                  <strong>{voice.name}</strong>
                  <div className="muted">
                    {voice.gender} · {voice.accent} · {voice.language}
                  </div>
                  <code>{voice.id}</code>
                  {voice.id === defaultVoiceId && <span className="badge">{t("badgeDefault")}</span>}
                </div>
              </button>
              <div className="voice-card-actions">
                <button
                  type="button"
                  title={t("playSample")}
                  disabled={!voice.sample_url}
                  onClick={() => playSample(voice)}
                >
                  ▶
                </button>
                {!voice.sample_url && (
                  <button type="button" disabled={busy} onClick={() => void generateOne(voice.id)}>
                    {t("bake")}
                  </button>
                )}
                <button
                  type="button"
                  title={t("favorite")}
                  className={fav ? "active" : ""}
                  onClick={() => toggleFavorite(voice.id)}
                >
                  ★
                </button>
                <button
                  type="button"
                  title={t("compare")}
                  className={inCompare ? "active" : ""}
                  onClick={() => toggleCompare(voice.id)}
                >
                  ⇄
                </button>
                <button type="button" title={t("setDefault")} onClick={() => onDefaultVoiceChange(voice.id)}>
                  ⌂
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {compare.length >= 2 && (
        <div className="voice-compare">
          <strong>
            {t("compareTitle")} ({compare.length}/3)
          </strong>
          <div className="voice-compare-row">
            {compare.map((id) => {
              const voice = voices.find((item) => item.id === id);
              if (!voice) return null;
              return (
                <div key={id} className="voice-compare-item">
                  <VoiceAvatar gender={voice.gender} />
                  <span>{voice.name}</span>
                  <button type="button" disabled={!voice.sample_url} onClick={() => playSample(voice)}>
                    ▶ {t("sampleLabel")}
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setCompare([])}>
            {t("clearCompare")}
          </button>
        </div>
      )}
    </div>
  );
}
