// Relative Path: ./YoutubeDownloader.tsx
import React, { useMemo } from "react";
import styles from "./YoutubeDownloader.scss";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import UiMedia from "@webstack/components/UiMedia/controller/UiMedia";
import { useYoutube } from "../hooks/useYoutube";
import { YoutubeVariant } from "~/src/core/services/YoutubeService/IYoutubeService";

const timeline = [
  { key: "validating", label: "Validate", note: "Link + auth", at: 10 },
  { key: "processing", label: "Resolve streams", note: "Sizing cuts", at: 40 },
  { key: "downloading", label: "Stage download", note: "Packaging", at: 75 },
  { key: "ready", label: "Ready", note: "Browser delivery", at: 100 },
];

const statusCopy: Record<string, string> = {
  idle: "Paste any YouTube share link to prepare a download.",
  validating: "Validating the link and fingerprinting the stream.",
  processing: "Estimating sizes and available renditions.",
  downloading: "Staging your selection.",
  ready: "Download is ready to ship to your browser.",
  error: "We could not prepare that link. Try again or refresh.",
};

const extractVideoId = (raw?: string | null): string | null => {
  if (!raw) return null;
  const cleaned = raw.trim();

  // Handle youtu.be short links
  const youtubeShortMatch = cleaned.match(/youtu\.be\/([^?&#]+)/);
  if (youtubeShortMatch?.[1]) {
    return youtubeShortMatch[1].split('/')[0];
  }

  try {
    const url = new URL(cleaned);

    // Handle youtu.be domain
    if (url.hostname.includes("youtu.be")) {
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[0]?.split('?')[0] || null;
    }

    // Handle youtube.com/watch?v= links
    const v = url.searchParams.get("v");
    if (v) return v;

    // Handle youtube.com/embed/ links
    const segments = url.pathname.split("/").filter(Boolean);
    const embedIdx = segments.indexOf("embed");
    if (embedIdx >= 0 && segments[embedIdx + 1]) {
      return segments[embedIdx + 1].split('?')[0];
    }
  } catch {
    // Fallback: try regex extraction
    const match = cleaned.match(/(?:v=|youtu\.be\/)([^&?/#]+)/);
    if (match?.[1]) return match[1];
  }
  return null;
};

const YoutubeDownloader: React.FC = () => {
  const {
    url,
    setUrl,
    state,
    stripeId,
    submitUrl,
    selectVariant,
    refreshStatus,
    reset,
    verifyDownloadUrl,
  } = useYoutube();

  const job = state.job;
  const variants = job?.video?.available ?? [];
  const selectedKey =
    job?.video?.selected &&
    `${job.video.selected.resolution}-${job.video.selected.format}`;

  const thumbnailUrl = useMemo(() => {
    const id = extractVideoId(job?.video?.sourceUrl || url);
    return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null;
  }, [job?.video?.sourceUrl, url]);

  const progressValue = Math.min(
    100,
    Math.max(state.progress ?? 0, job?.progress ?? 0)
  );

  const description =
    state.message ||
    statusCopy[state.status] ||
    "Paste a YouTube link to size your download.";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitUrl();
  };

  const renderVariant = (variant: YoutubeVariant) => {
    if (!variant?.resolution || !variant?.format) return null;

    const key = `${variant.resolution}-${variant.format}`;
    const isSelected = selectedKey === key;
    const isBusy = state.variantLoading === key;
    const hasError = state.status === "error";

    return (
      <div
        key={key}
        className={`youtube-downloader__variant ${isSelected ? "is-selected" : ""
          } ${hasError ? "is-disabled" : ""}`}
      >
        <div className="youtube-downloader__variant-header">
          <span className="youtube-downloader__variant-resolution">
            {variant.resolution}
          </span>
          <span className="youtube-downloader__variant-format">
            {(variant.format || "").toUpperCase()}
          </span>
        </div>
        <div className="youtube-downloader__variant-meta">
          <span>{variant.label || "Balanced quality"}</span>
          {variant.sizeMb ? (
            <span className="youtube-downloader__variant-size">
              ~{variant.sizeMb} MB
            </span>
          ) : null}
        </div>
        <UiButton
          variant={isSelected ? "flat" : "primary"}
          busy={isBusy}
          disabled={hasError || isBusy}
          onClick={() => selectVariant(variant)}
        >
          {isSelected ? "Selected" : "Prepare this cut"}
        </UiButton>
      </div>
    );
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="youtube-downloader">
        <section className="youtube-downloader__hero">
          <div className="youtube-downloader__badge">
            <UiIcon icon="fa-youtube" />
            <span>YTL studio</span>
          </div>
          <h1>Youtube Downloader</h1>
          <p>
            Modernized ingest that previews available resolutions, estimates
            file size, and delivers your selection without guesswork.
          </p>
          <div className="youtube-downloader__meta">
            <span>
              <UiIcon icon="fal-user" />{" "}
              <span suppressHydrationWarning>
                {stripeId ? `Stripe: ${stripeId}` : "Guest session"}
              </span>
            </span>
            {job?.video?.bestResolution ? (
              <span>
                <UiIcon icon="fal-sparkles" />{" "}
                {job.video.bestResolution} best available
              </span>
            ) : null}
          </div>
          {thumbnailUrl && (
            <div className="youtube-downloader__thumb">
              <UiMedia
                src={thumbnailUrl}
                alt={job?.video?.title || "YouTube preview"}
                variant="cover"
                loadingText="Fetching thumbnail"
              />
              <div className="youtube-downloader__thumb-meta">
                <UiIcon icon="fa-photo-video" /> Live preview pulled from your
                link.
              </div>
            </div>
          )}
        </section>

        <section className="youtube-downloader__panel">
          <form className="youtube-downloader__form" onSubmit={handleSubmit}>
            <UiInput
              name="youtube-url"
              label="Share URL"
              value={url}
              onChange={(e: any) => setUrl(e?.target?.value || "")}
              placeholder="https://youtu.be/..."
              required
              type="url"
              traits={{ beforeIcon: "fa-link" }}
            />
            <div className="youtube-downloader__actions">
              <UiButton
                type="submit"
                variant="primary"
                busy={["validating", "processing"].includes(state.status)}
                disabled={!url}
                traits={{ afterIcon: "fa-arrow-right" }}
              >
                {job ? "Refresh variants" : "Pull variants"}
              </UiButton>
              <UiButton
                variant="flat"
                onClick={refreshStatus}
                disabled={!job}
              >
                <UiIcon icon="fa-rotate-right" /> Refresh status
              </UiButton>
              <UiButton variant="link" onClick={reset}>
                Reset
              </UiButton>
              {job?.download?.url ? (
                <UiButton variant="link" onClick={() => verifyDownloadUrl(job)}>
                  Check download
                </UiButton>
              ) : null}
            </div>
          </form>

          <div className="youtube-downloader__progress">
            <div
              className="youtube-downloader__progress-bar"
              style={{ width: `${progressValue}%` }}
            />
            <div className="youtube-downloader__progress-label">
              <span>{description}</span>
              <span>{progressValue}%</span>
            </div>
          </div>

          <div className="youtube-downloader__timeline">
            {timeline.map((stage) => {
              const isDone = progressValue >= stage.at;
              const isActive = state.status === stage.key;
              return (
                <div
                  key={stage.key}
                  className={`youtube-downloader__step ${isDone ? "is-done" : ""
                    } ${isActive ? "is-active" : ""}`}
                >
                  <div className="youtube-downloader__step-title">
                    {stage.label}
                  </div>
                  <div className="youtube-downloader__step-note">
                    {stage.note}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="youtube-downloader__grid">
          <div className="youtube-downloader__grid-head">
            <div>
              <p className="youtube-downloader__eyebrow">Available variants</p>
              <h2>Pick your resolution and container</h2>
              <p>
                Loading states are shown as each step completes so you always
                know where the download is in the pipeline.
              </p>
            </div>
            {state.error ? (
              <div className="youtube-downloader__error">
                <UiIcon icon="fa-triangle-exclamation" /> {state.error}
              </div>
            ) : null}
          </div>
          <div className="youtube-downloader__variants">
            {state.status === "error" && !variants.length ? (
              <div className="youtube-downloader__error">
                Unable to load variants. Please check the URL and try again.
              </div>
            ) : variants.length ? (
              variants.map(renderVariant)
            ) : (
              ["1080p", "720p", "audio"].map((label) => (
                <div
                  key={label}
                  className="youtube-downloader__variant is-placeholder"
                >
                  <div className="youtube-downloader__variant-header">
                    <span className="youtube-downloader__variant-resolution">
                      {label}
                    </span>
                    <span className="youtube-downloader__variant-format">
                      loading
                    </span>
                  </div>
                  <div className="youtube-downloader__variant-meta">
                    <span>Waiting for a valid URL</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="youtube-downloader__summary">
          <div>
            <p className="youtube-downloader__eyebrow">Selection</p>
            <h3>{job?.video?.title || "Awaiting selection"}</h3>
            <p className="youtube-downloader__muted">
              {job?.video?.sourceUrl || "Enter a URL to begin processing."}
            </p>
          </div>
          <div className="youtube-downloader__summary-actions">
            {job?.download?.url ? (
              <UiButton
                href={state.downloadReady ? job.download.url : undefined}
                onClick={
                  state.downloadReady
                    ? undefined
                    : (e) => {
                      e.preventDefault();
                      verifyDownloadUrl(job);
                    }
                }
                target={state.downloadReady ? "_blank" : undefined}
                rel="noreferrer"
                variant={state.downloadReady ? "primary" : "flat"}
                traits={{ afterIcon: "fa-download" }}
                disabled={!state.downloadReady}
              >
                {state.downloadReady ? "Download file" : "Staging file..."}
              </UiButton>
            ) : (
              <UiButton
                variant="flat"
                disabled
                traits={{ afterIcon: "fa-download" }}
              >
                Waiting for resolution choice
              </UiButton>
            )}
            {job?.video?.selected ? (
              <div className="youtube-downloader__pill">
                {job.video.selected.resolution} ·{" "}
                {(job.video.selected.format || "").toUpperCase()} ·{" "}
                {job.video.selected.sizeMb
                  ? `~${job.video.selected.sizeMb} MB`
                  : "estimated"}
              </div>
            ) : null}
            {!state.downloadReady && job?.download?.url ? (
              <div className="youtube-downloader__note">
                <UiIcon icon="fa-info-circle" /> We verify the file exists
                before opening—give it a moment or tap check download.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
};

export default YoutubeDownloader;
