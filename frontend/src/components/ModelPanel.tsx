import { useEffect, useState } from "react";
import { api } from "../api";
import type { TranslateFn } from "../i18n";
import type { BenchmarkResult, DownloadJob, ModelInfo, OfflineStatus } from "../types";

type Props = {
  selectedModelId: string;
  onSelectedModelId: (id: string) => void;
  onError: (message: string) => void;
  onStatus: (message: string) => void;
  t: TranslateFn;
};

export function ModelPanel({ selectedModelId, onSelectedModelId, onError, onStatus, t }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [offline, setOffline] = useState<OfflineStatus | null>(null);
  const [download, setDownload] = useState<DownloadJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);

  async function refresh() {
    const [list, status] = await Promise.all([api.listModels(), api.offlineStatus()]);
    setModels(list);
    setOffline(status);
    const selected = list.find((item) => item.selected);
    if (selected) onSelectedModelId(selected.id);
  }

  useEffect(() => {
    refresh().catch((e) => onError(e.message));
  }, []);

  useEffect(() => {
    if (!download || download.status === "done" || download.status === "error" || download.status === "cancelled") {
      return;
    }
    const timer = window.setInterval(() => {
      api
        .downloadStatus(download.id)
        .then((job) => {
          setDownload(job);
          if (job.status === "done") {
            onStatus(t("downloadComplete"));
            refresh().catch((e) => onError(e.message));
          }
          if (job.status === "error") onError(job.error || t("downloadFailed"));
        })
        .catch((e) => onError(e.message));
    }, 500);
    return () => window.clearInterval(timer);
  }, [download?.id, download?.status]);

  async function select(modelId: string) {
    try {
      setBusy(true);
      await api.selectModel(modelId);
      onSelectedModelId(modelId);
      onStatus(t("selectedModelStatus", { id: modelId }));
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadModel(modelId: string) {
    try {
      setBusy(true);
      const job = await api.downloadModel(modelId);
      setDownload(job);
      onStatus(t("downloadingModel", { id: modelId }));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadVoices() {
    try {
      setBusy(true);
      const job = await api.downloadVoices();
      setDownload(job);
      onStatus(t("downloadingVoices"));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function load(modelId: string) {
    try {
      setBusy(true);
      await api.selectModel(modelId);
      await api.loadModel(modelId);
      onSelectedModelId(modelId);
      onStatus(t("loadedModel", { id: modelId }));
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(modelId: string) {
    if (!window.confirm(t("confirmDeleteModel", { id: modelId }))) return;
    try {
      setBusy(true);
      await api.deleteModel(modelId);
      onStatus(t("deletedModel", { id: modelId }));
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runBenchmark() {
    try {
      setBusy(true);
      onStatus(t("runningBenchmark"));
      const result = await api.runBenchmark({
        include_listening_samples: true,
        voice_id: "af_heart",
      });
      setBenchmark(result);
      onStatus(t("benchmarkFinished"));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-body model-panel">
      {offline && (
        <p className={`offline-banner ${offline.offline_ready ? "ok" : "warn"}`}>
          {offline.offline_ready ? t("offlineReady") : t("offlineNotReady")}
        </p>
      )}
      {!offline?.voices_installed && (
        <button type="button" disabled={busy} onClick={() => void downloadVoices()}>
          {t("downloadVoicePack")}
        </button>
      )}
      {download && download.status === "running" && (
        <div className="download-progress">
          <div>
            {t("downloading")} {download.target}: {download.progress.toFixed(0)}%
          </div>
          <button type="button" className="danger" onClick={() => void api.cancelDownload(download.id)}>
            {t("cancelDownload")}
          </button>
        </div>
      )}
      <div className="model-list">
        {models.map((model) => (
          <article key={model.id} className={`model-card ${model.selected ? "selected" : ""}`}>
            <header>
              <strong>{model.id}</strong>
              {model.recommended && <span className="badge">{t("recommended")}</span>}
              {model.loaded && <span className="badge">{t("loaded")}</span>}
            </header>
            <p className="muted">
              {model.precision} · {model.approx_size_label || "n/a"} · {model.runtime}
            </p>
            <p>{model.description}</p>
            <p className="muted">
              {model.installed ? t("installed") : t("notInstalled")}
              {model.runtime === "onnx" && !model.voices_installed ? ` · ${t("voicesMissing")}` : ""}
              {model.integrity && model.runtime === "onnx" ? ` · ${model.integrity}` : ""}
            </p>
            <div className="model-actions">
              <button type="button" disabled={busy || model.selected} onClick={() => void select(model.id)}>
                {t("select")}
              </button>
              {model.runtime === "onnx" && !model.installed && (
                <button type="button" disabled={busy} onClick={() => void downloadModel(model.id)}>
                  {t("download")}
                </button>
              )}
              {model.installed && (
                <button type="button" disabled={busy} onClick={() => void load(model.id)}>
                  {t("load")}
                </button>
              )}
              {model.runtime === "onnx" && model.installed && (
                <button type="button" className="danger" disabled={busy} onClick={() => void remove(model.id)}>
                  {t("delete")}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="benchmark-block">
        <button type="button" disabled={busy} onClick={() => void runBenchmark()}>
          {t("runBenchmark")}
        </button>
        <p className="muted">{t("benchmarkHint")}</p>
        {benchmark && (
          <div className="benchmark-results">
            {benchmark.results.map((row) => (
              <div key={row.model_id} className="benchmark-row">
                <strong>{row.model_id}</strong>
                {row.error ? (
                  <span className="error-text">{row.error}</span>
                ) : (
                  <span className="muted">
                    load {row.load_seconds?.toFixed(2)}s · first {row.first_generation_seconds?.toFixed(2)}s · warm{" "}
                    {row.warm_generation_seconds?.toFixed(2)}s · RTF {row.realtime_factor?.toFixed(2) ?? "n/a"}
                    {row.sample_url ? (
                      <>
                        {" "}
                        · <a href={api.base + row.sample_url}>{t("listen")}</a>
                      </>
                    ) : null}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="muted">
        {t("selectedPrefix")}: {selectedModelId}. {t("selectedModelHint")}
      </p>
    </div>
  );
}
