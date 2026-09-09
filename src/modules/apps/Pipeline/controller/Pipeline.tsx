// Relative Path: ./Pipeline.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import styles from "./Pipeline.scss";
import PipelineCameraShare from "../components/PipelineCameraShare/controller/PipelineCameraShare";
import PipelineScreenShare from "../components/PipelineScreenShare/controller/PipelineScreenShare";
import { PipelineProvider, usePipeline } from "../context/PipelineProvider";
import { PipelineKind } from "~/src/core/services/PipelineService/PipelineService";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import useProfile from "~/src/core/authentication/hooks/useProfile";

const isBinderKind = (k: unknown): k is "camera" | "screen" =>
  k === "camera" || k === "screen";

const firstStr = (v: string | string[] | undefined): string | undefined => {
  if (Array.isArray(v)) return v[0];
  return v;
};

const SOURCE_LABELS: Record<PipelineKind, { label: string; icon: string; description: string }> = {
  camera: { label: "Camera", icon: "fa-video", description: "Share your webcam via WebRTC" },
  screen: { label: "Screen", icon: "fa-desktop", description: "Share your screen or window" },
  rtmp: { label: "RTMP Push", icon: "fa-broadcast-tower", description: "Receive from OBS, Streamlabs, etc." },
  pull: { label: "Pull URL", icon: "fa-link", description: "Ingest from RTSP, HLS, or other URL" },
};

const PipelineView: React.FC = () => {
  const {
    view,
    setView,
    resumableKind,
    session,
    sessions,
    viewerUrl,
    hlsUrl,
    busy,
    error,
    publisherError,
    publisherState,
    statusLabel,
    streamStatus,
    start,
    startRtmp,
    startPull,
    stop,
    retryLastPublish,
    setActiveSession,
    updateStreamKey,
  } = usePipeline();

  const [pullUrl, setPullUrl] = useState("");
  const [rtmpLabel, setRtmpLabel] = useState("");
  const [pullLabel, setPullLabel] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [editKeyValue, setEditKeyValue] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  const router = useRouter();
  const profile = useProfile();
  const queryKind = firstStr(router.query.kind);
  const queryOverlayId = firstStr(router.query.overlayId);
  const queryEventId = firstStr(router.query.eventId);
  const queryUserId = firstStr(router.query.userId);
  const binderMode = !!(isBinderKind(queryKind) && queryOverlayId);
  const binderKind = binderMode ? (queryKind as "camera" | "screen") : null;
  const userId = (queryUserId || profile?.id || (profile as any)?.memberId || "") as string;

  const sourceContext = useMemo(() => {
    const p: any = profile || {};
    const ua = p?.userAgent?.user_agent_data;
    const browser = (ua?.brands || []).find((e: any) => e?.brand && !/not\.a\/brand/i.test(e.brand))?.brand || '';
    const platform = ua?.platform || '';
    const deviceClass = ua?.mobile ? 'mobile' : 'desktop';
    const name = String(p?.name || '').trim();
    const email = String(p?.email || '').trim();
    const address = p?.metadata?.user?.address || p?.address;
    const location = [address?.city, address?.state].filter(Boolean).join(', ');
    const label = [
      name || email || 'Unknown share source',
      [browser, platform].filter(Boolean).join(' on '),
      browser || platform ? deviceClass : '',
      location,
    ].filter(Boolean).join(' • ');
    return { label, name, email, platform, browser };
  }, [profile]);

  const binderStartOptions = useMemo(
    () => binderMode ? ({
      userId: userId || undefined,
      streamId: queryEventId || undefined,
      overlayId: queryOverlayId || undefined,
      label: sourceContext.label,
      meta: { sourceContext },
    }) : undefined,
    [binderMode, userId, queryEventId, queryOverlayId, sourceContext],
  );

  // Force the view to the binder kind so the source grid never flashes
  useEffect(() => {
    if (!binderMode || !binderKind) return;
    if (view !== binderKind) setView(binderKind);
  }, [binderMode, binderKind, view, setView]);

  // Broadcast publisher state to the editor tab(s) that opened this popup
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (!binderMode || !queryOverlayId) return;
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`canopy-publisher-${queryOverlayId}`);
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [binderMode, queryOverlayId]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const payload = () => ({
      type: "pipeline-state",
      overlayId: queryOverlayId,
      sessionId: session?.id ?? null,
      publisherState,
      statusLabel,
      error: error || publisherError || null,
    });
    channel.postMessage(payload());
    // Heartbeat so editor tabs that mount the listener AFTER Go-Live still
    // pick up the current sessionId and bind the overlay. Broadcasts don't
    // replay, so late subscribers would otherwise miss the only message.
    if (!session?.id) return;
    const handle = window.setInterval(() => {
      channel.postMessage(payload());
    }, 2000);
    return () => window.clearInterval(handle);
  }, [publisherState, statusLabel, session?.id, error, publisherError, queryOverlayId]);

  const displayStreamKey = session?.streamKey || session?.id || "";

  const handleEditKey = () => {
    setEditKeyValue(displayStreamKey);
    setEditingKey(true);
    setKeyError(null);
  };

  const handleSaveKey = async () => {
    if (!session?.id || !editKeyValue.trim()) return;
    setKeyError(null);
    try {
      const updated = await updateStreamKey(session.id, editKeyValue.trim());
      if (updated) setEditingKey(false);
    } catch (err: any) {
      setKeyError(err?.message || "Failed to update stream key");
    }
  };

  const handleStartRtmp = async () => {
    await startRtmp(rtmpLabel || undefined);
    setRtmpLabel("");
  };

  const handleStartPull = async () => {
    if (!pullUrl.trim()) return;
    await startPull(pullUrl.trim(), pullLabel || undefined);
    setPullUrl("");
    setPullLabel("");
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="pipeline">
        <header className="pipeline__header">
          <div>
            <h1>Pipeline</h1>
            <p className="pipeline__sub">Stream from camera, screen, RTMP encoder, or pull from URL.</p>
          </div>
          <div className="pipeline__status">{statusLabel}</div>
        </header>

        {/* Source Selection Grid */}
        {!binderMode && view === "main" && (
          <div className="pipeline__sources">
            {(Object.keys(SOURCE_LABELS) as PipelineKind[]).map((kind) => (
              <button
                key={kind}
                className={`pipeline__source-card ${resumableKind === kind ? "pipeline__source-card--resumable" : ""}`}
                onClick={() => setView(kind)}
                disabled={busy}
              >
                <i className={`fa ${SOURCE_LABELS[kind].icon}`} />
                <span className="pipeline__source-label">{SOURCE_LABELS[kind].label}</span>
                <span className="pipeline__source-desc">{SOURCE_LABELS[kind].description}</span>
                {resumableKind === kind && <span className="pipeline__source-badge">Resume</span>}
              </button>
            ))}
          </div>
        )}

        {/* Active Sessions List */}
        {!binderMode && sessions.length > 0 && view === "main" && (
          <div className="pipeline__sessions">
            <h3>Active Sessions</h3>
            <div className="pipeline__sessions-list">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`pipeline__session-item ${session?.id === s.id ? "pipeline__session-item--active" : ""}`}
                  onClick={() => setActiveSession(s)}
                >
                  <i className={`fa ${SOURCE_LABELS[s.kind || "camera"].icon}`} />
                  <span className="pipeline__session-label">{s.label || s.kind || "Stream"}</span>
                  <span className={`pipeline__session-status ${s.streamReady ? "pipeline__session-status--live" : ""}`}>
                    {s.streamReady ? "🟢 Live" : "⏳ Pending"}
                  </span>
                  <UiButton
                    variant="link"
                    traits={{ beforeIcon: "fa-stop" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      stop(s.id);
                    }}
                  >
                    Stop
                  </UiButton>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation back */}
        {!binderMode && view !== "main" && (
          <div className="pipeline__nav">
            <UiButton variant="link" traits={{ beforeIcon: "fa-chevron-left" }} onClick={() => setView("main")} disabled={busy}>
              Back to sources
            </UiButton>
          </div>
        )}

        {/* Session Info & URLs */}
        {!binderMode && session && (
          <div className="pipeline__links">
            {session.kind === "rtmp" && session.rtmpUrl && (
              <div className="pipeline__link-row pipeline__link-row--rtmp">
                <span>📡 RTMP Server URL:</span>
                <code>{session.rtmpUrl}</code>
                <UiButton
                  variant="secondary"
                  onClick={() => navigator?.clipboard?.writeText(session.rtmpUrl || "").catch(() => undefined)}
                >
                  Copy
                </UiButton>
              </div>
            )}
            {session.kind === "rtmp" && (
              <div className="pipeline__link-row pipeline__link-row--rtmp">
                <span>🔑 Stream Key:</span>
                {editingKey ? (
                  <>
                    <input
                      type="text"
                      value={editKeyValue}
                      onChange={(e) => setEditKeyValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveKey();
                        if (e.key === "Escape") setEditingKey(false);
                      }}
                      style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#0d0d1a", color: "#fff", fontSize: 13, minWidth: 160 }}
                      autoFocus
                    />
                    <UiButton variant="primary" onClick={handleSaveKey} disabled={busy || !editKeyValue.trim()}>
                      Save
                    </UiButton>
                    <UiButton variant="secondary" onClick={() => setEditingKey(false)}>
                      Cancel
                    </UiButton>
                    {keyError && <span style={{ color: "#ef4444", fontSize: 12 }}>{keyError}</span>}
                  </>
                ) : (
                  <>
                    <code>{displayStreamKey}</code>
                    <UiButton
                      variant="secondary"
                      onClick={handleEditKey}
                    >
                      Edit
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      onClick={() => navigator?.clipboard?.writeText(displayStreamKey).catch(() => undefined)}
                    >
                      Copy
                    </UiButton>
                  </>
                )}
              </div>
            )}
            {session.kind === "rtmp" && !streamStatus?.streamReady && (
              <div className="pipeline__rtmp-instructions">
                <p>
                  <strong>Instructions:</strong> Configure your encoder (OBS, Streamlabs, etc.) with:
                </p>
                <ul>
                  <li>Server: <code>{session.rtmpUrl}</code></li>
                  <li>Stream Key: <code>{displayStreamKey}</code></li>
                  {/* <UiInput value={defaultStreamKey} readOnly  name="streamKey" onChange={updateEncoderPushStreamKey}/> */}
                </ul>
                <p>The status will update automatically when your encoder connects.</p>
              </div>
            )}
            <div className="pipeline__link-row">
              <span>🌐 Public view URL:</span>
              <a href={viewerUrl} target="_blank" rel="noreferrer">
                {viewerUrl}
              </a>
              <UiButton
                variant="secondary"
                onClick={() => navigator?.clipboard?.writeText(viewerUrl || "").catch(() => undefined)}
                disabled={!viewerUrl}
              >
                Copy
              </UiButton>
            </div>
            {(hlsUrl || streamStatus?.hlsReady) && (
              <div className="pipeline__link-row">
                <span>📺 HLS (.m3u8):</span>
                <a href={hlsUrl} target="_blank" rel="noreferrer">
                  {hlsUrl}
                </a>
                <UiButton
                  variant="secondary"
                  onClick={() => navigator?.clipboard?.writeText(hlsUrl || "").catch(() => undefined)}
                >
                  Copy
                </UiButton>
              </div>
            )}
            {streamStatus && (
              <div className="pipeline__metrics">
                <span>Bytes received: {(streamStatus.bytesReceived / 1024).toFixed(1)} KB</span>
                <span>Bytes sent: {(streamStatus.bytesSent / 1024).toFixed(1)} KB</span>
                <span>Publishers: {streamStatus.activePublishers}</span>
                <span>Readers: {streamStatus.activeReaders}</span>
              </div>
            )}
          </div>
        )}

        {error && <div className="pipeline__error">{error}</div>}
        {publisherError && session && (
          <div className="pipeline__error">
            {publisherError}
            <UiButton variant="secondary" onClick={retryLastPublish} disabled={busy}>
              Retry publish
            </UiButton>
          </div>
        )}

        {/* Camera View */}
        {view === "camera" && (
          <PipelineCameraShare
            busy={busy}
            onPublish={async (stream, options) => {
              await start("camera", stream, { ...(binderStartOptions ?? {}), ...(options ?? {}) });
            }}
            onStop={() => stop()}
            viewerUrl={viewerUrl}
            publisherState={publisherState}
          />
        )}

        {/* Screen View */}
        {view === "screen" && (
          <PipelineScreenShare
            busy={busy}
            onPublish={async (stream, options) => {
              await start("screen", stream, { ...(binderStartOptions ?? {}), ...(options ?? {}) });
            }}
            onStop={() => stop()}
            viewerUrl={viewerUrl}
            publisherState={publisherState}
          />
        )}

        {/* RTMP View */}
        {!binderMode && view === "rtmp" && !session && (
          <div className="pipeline__rtmp-setup">
            <h2>RTMP Push Setup</h2>
            <p>Create an RTMP endpoint to receive streams from OBS, Streamlabs, or other encoders.</p>
            <div className="pipeline__form-row">
              <label>Label (optional):</label>
              <input
                type="text"
                value={rtmpLabel}
                onChange={(e) => setRtmpLabel(e.target.value)}
                placeholder="e.g., Main Camera, Game Stream"
                disabled={busy}
              />
            </div>
            <UiButton onClick={handleStartRtmp} disabled={busy}>
              Create RTMP Endpoint
            </UiButton>
          </div>
        )}

        {!binderMode && view === "rtmp" && session && (
          <div className="pipeline__rtmp-active">
            <h2>RTMP Session Active</h2>
            <UiButton variant="secondary" onClick={() => stop()} disabled={busy}>
              Stop Session
            </UiButton>
          </div>
        )}

        {/* Pull URL View */}
        {!binderMode && view === "pull" && !session && (
          <div className="pipeline__pull-setup">
            <h2>Pull from URL</h2>
            <p>Ingest from an external RTSP, RTMP, HLS, or other stream URL.</p>
            <div className="pipeline__form-row">
              <label>Source URL:</label>
              <input
                type="text"
                value={pullUrl}
                onChange={(e) => setPullUrl(e.target.value)}
                placeholder="rtsp://example.com/stream or http://example.com/live.m3u8"
                disabled={busy}
              />
            </div>
            <div className="pipeline__form-row">
              <label>Label (optional):</label>
              <input
                type="text"
                value={pullLabel}
                onChange={(e) => setPullLabel(e.target.value)}
                placeholder="e.g., Security Cam, News Feed"
                disabled={busy}
              />
            </div>
            <UiButton onClick={handleStartPull} disabled={busy || !pullUrl.trim()}>
              Start Pulling
            </UiButton>
          </div>
        )}

        {!binderMode && view === "pull" && session && (
          <div className="pipeline__pull-active">
            <h2>Pull Session Active</h2>
            <p>Ingesting from: <code>{session.meta?.sourceUrl || "external source"}</code></p>
            <UiButton variant="secondary" onClick={() => stop()} disabled={busy}>
              Stop Session
            </UiButton>
          </div>
        )}
      </div>
    </>
  );
};

const Pipeline: React.FC = () => (
  <PipelineProvider>
    <PipelineView />
  </PipelineProvider>
);

export default Pipeline;