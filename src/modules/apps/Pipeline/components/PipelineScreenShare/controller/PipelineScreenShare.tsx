// Relative Path: ./PipelineScreenShare.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiSelect from "@webstack/components/UiForm/components/UiSelect/UiSelect";
import useSessionStorage from "~/src/webstack/hooks/storage/useSessionStorage";
import useMediaDevices from "~/src/webstack/hooks/media/useMediaDevices";
import { PublishOptions, PublishState } from "../../useWhipPublisher";
import styles from "./PipelineScreenShare.scss";
import PipelineMedia from "../../../views/PipeLineMedia/controller/PipelineMedia";

type Props = {
  busy?: boolean;
  viewerUrl?: string;
  publisherState: PublishState;
  onPublish: (stream: MediaStream, options?: PublishOptions) => Promise<void>;
  onStop: () => Promise<void>;
};

type BitratePreset = {
  id: string;
  label: string;
  kbps: number;
};

const BITRATE_PRESETS: BitratePreset[] = [
  { id: "low", label: "Low (1.0 Mbps)", kbps: 1000 },
  { id: "med", label: "Medium (2.5 Mbps)", kbps: 2500 },
  { id: "high", label: "High (4.0 Mbps)", kbps: 4000 },
];

const PipelineScreenShare: React.FC<Props> = ({ busy, viewerUrl, publisherState, onPublish, onStop }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screenLabel, setScreenLabel] = useState<string>("Not selected");
  const [micError, setMicError] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const frameSeenRef = useRef<boolean>(false);
  const { mics, outputs, refresh, loading: devicesLoading } = useMediaDevices();
  const { getSessionItem, setSessionItem } = useSessionStorage();
  const [selectedMic, setSelectedMic] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState<boolean>(true);
  const [systemAudio, setSystemAudio] = useState<boolean>(true);
  const [bitratePresetId, setBitratePresetId] = useState<string>("low");
  const videoKey = stream?.id ?? "pipeline-screen";
  const normalizeOption = (val: string | { value?: string; label?: string } | null | undefined) =>
    typeof val === "string" ? val : val?.value;

  const stopTracks = useCallback(() => {
    setStream((prev) => {
      prev?.getTracks().forEach((t) => {
        console.debug("[Pipeline] stopping track", { kind: t.kind, label: t.label, state: t.readyState });
        t.stop();
      });
      return null;
    });
    setMicStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);

  useEffect(() => () => stopTracks(), [stopTracks]);

  // hydrate from session storage once devices are known
  useEffect(() => {
    if (devicesLoading) return;
    const storedMic = getSessionItem("pipeline:screen:mic")?.value;
    const storedMicEnabled = getSessionItem("pipeline:screen:micEnabled")?.value;
    const storedSystemAudio = getSessionItem("pipeline:screen:systemAudio")?.value;
    const storedBitrate = getSessionItem("pipeline:screen:bitratePreset")?.value;

    if (!selectedMic) {
      const match = mics.find((m) => m.deviceId === storedMic)?.deviceId || mics[0]?.deviceId || null;
      setSelectedMic(match);
    }
    if (typeof storedMicEnabled === "boolean") setMicEnabled(storedMicEnabled);
    if (typeof storedSystemAudio === "boolean") setSystemAudio(storedSystemAudio);
    if (storedBitrate && BITRATE_PRESETS.some((b) => b.id === storedBitrate)) setBitratePresetId(storedBitrate);
  }, [devicesLoading, getSessionItem, mics, selectedMic]);

  const bitratePreset = useMemo(
    () => BITRATE_PRESETS.find((b) => b.id === bitratePresetId) ?? BITRATE_PRESETS[1],
    [bitratePresetId]
  );

  const toggleMicEnabled = useCallback(() => {
    setMicEnabled((prev) => {
      const next = !prev;
      setSessionItem("pipeline:screen:micEnabled", { value: next });
      return next;
    });
  }, [setSessionItem]);

  const toggleSystemAudio = useCallback(() => {
    setSystemAudio((prev) => {
      const next = !prev;
      setSessionItem("pipeline:screen:systemAudio", { value: next });
      return next;
    });
  }, [setSessionItem]);

  const composedStream = useMemo(() => {
    const tracks: MediaStreamTrack[] = [];
    if (stream) tracks.push(...stream.getTracks());
    if (micStream) tracks.push(...micStream.getTracks());
    return tracks.length ? new MediaStream(tracks) : null;
  }, [micStream, stream]);

  useEffect(() => {
    if (!micEnabled && micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      setMicStream(null);
    }
  }, [micEnabled, micStream]);
  const startPreview = useCallback(async () => {
    setError(null);
    setPreviewNotice(null);
    frameSeenRef.current = false;
    try {
      const previousStream = stream;
      const previousMic = micStream;
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: systemAudio ? { systemAudio: "include" } : false,
      } as MediaStreamConstraints);
      setStream(media);
      if (previousStream) {
        previousStream.getTracks().forEach((t) => {
          console.debug("[Pipeline] stopping previous screen track", { kind: t.kind, label: t.label, state: t.readyState });
          t.stop();
        });
      }
      if (previousMic) {
        previousMic.getTracks().forEach((t) => t.stop());
      }
      const track = media.getVideoTracks()[0];
      setScreenLabel(track?.label || "Screen selected");
      console.debug("[Pipeline] screen selected", track?.label, track?.getSettings?.());
      media.getTracks().forEach((t) =>
        t.addEventListener("ended", () => console.debug("[Pipeline] track ended", { kind: t.kind, label: t.label }))
      );
      setSessionItem("pipeline:screen:systemAudio", { value: systemAudio });
      setSessionItem("pipeline:screen:bitratePreset", { value: bitratePresetId });
    } catch (err: any) {
      setError(err?.message ?? "Unable to share screen");
      console.error("[Pipeline] getDisplayMedia failed", err);
    }
  }, [bitratePresetId, micStream, setSessionItem, stream, systemAudio]);

  const addMicrophone = useCallback(async () => {
    setError(null);
    setMicError(null);
    try {
      if (!micEnabled) return;
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMic ? { exact: selectedMic } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      setMicStream(mic);
      setSessionItem("pipeline:screen:mic", { value: selectedMic });
      setSessionItem("pipeline:screen:micEnabled", { value: true });
      console.debug("[Pipeline] microphone added", mic.getAudioTracks().map((t) => t.label));
    } catch (err: any) {
      setError(err?.message ?? "Unable to add microphone source");
      setMicError(err?.message ?? "Unable to add microphone source");
      console.error("[Pipeline] getUserMedia mic failed", err);
    }
  }, [micEnabled, selectedMic, setSessionItem]);

  const goLive = useCallback(async () => {
    if (!stream) return;
    setError(null);
    try {
      const outbound = composedStream ?? stream;
      console.debug("[Pipeline] starting publish", {
        tracks: outbound.getTracks().map((t) => ({ kind: t.kind, label: t.label })),
      });
      await onPublish(outbound, { maxBitrateKbps: bitratePreset?.kbps });
    } catch (err: any) {
      setError(err?.message ?? "Failed to start stream");
      console.error("[Pipeline] publish failed", err);
    }
  }, [bitratePreset?.kbps, composedStream, onPublish, stream]);

  useEffect(() => {
    const activePreview = stream;
    if (!activePreview || !videoRef.current) return;
    const el = videoRef.current;
    const logDims = (tag: string) =>
      console.debug("[Pipeline] video", tag, {
        videoWidth: el.videoWidth,
        videoHeight: el.videoHeight,
        readyState: el.readyState,
      });
    const onLoadedMetadata = () => {
      logDims("loadedmetadata");
      el.play?.().then(() => logDims("playing"))?.catch((err) => {
        console.error("[Pipeline] play failed", err);
      });
    };
    el.onloadedmetadata = onLoadedMetadata;
    el.onloadeddata = () => logDims("loadeddata");
    el.oncanplay = () => logDims("canplay");
    el.onplaying = () => logDims("playing-event");
    el.onerror = (e) => console.error("[Pipeline] video error", e);
    console.debug("[Pipeline] preview attached", {
      tracks: activePreview.getTracks().map((t) => ({ kind: t.kind, label: t.label })),
    });
    const videoTrack = activePreview.getVideoTracks()[0];
    if (videoTrack) {
      console.debug("[Pipeline] video track state", {
        label: videoTrack.label,
        readyState: videoTrack.readyState,
        muted: videoTrack.muted,
        settings: videoTrack.getSettings?.(),
      });
      videoTrack.onmute = () => console.debug("[Pipeline] track mute");
      videoTrack.onunmute = () => console.debug("[Pipeline] track unmute");
      videoTrack.onended = () => console.debug("[Pipeline] track ended (video)");
    }
    let frameHandle: number | null = null;
    let watchdog: number | null = null;
    const frameCb = () => {
      frameSeenRef.current = true;
      setPreviewNotice(null);
      frameHandle = el.requestVideoFrameCallback?.(frameCb) ?? null;
    };
    if (el.requestVideoFrameCallback) {
      frameHandle = el.requestVideoFrameCallback(frameCb);
    } else {
      const poll = () => {
        const hasVideo = el.videoWidth > 0 && el.videoHeight > 0;
        if (hasVideo) {
          frameSeenRef.current = true;
          setPreviewNotice(null);
        }
      };
      frameHandle = window.setInterval(poll, 250) as unknown as number;
    }
    watchdog = window.setTimeout(() => {
      if (!frameSeenRef.current) {
        setPreviewNotice("No frames yet. Try sharing the entire screen or un-minimizing the window.");
      }
    }, 1200);
    // Fallback: if dimensions stay 0 shortly after attach, retry play and surface notice
    const retries = [300, 900];
    const timers = retries.map((ms) =>
      setTimeout(() => {
        const hasVideo = el.videoWidth > 0 && el.videoHeight > 0;
        if (hasVideo) {
          setPreviewNotice(null);
        } else {
          setPreviewNotice(
            "Preview not visible yet. Try sharing the entire screen or ensure the window is not minimized."
          );
          console.debug("[Pipeline] retrying play due to zero dimensions");
          el.play?.().catch((err) => console.error("[Pipeline] play retry failed", err));
        }
      }, ms)
    );
    return () => {
      timers.forEach(clearTimeout);
      el.onloadedmetadata = null;
      el.onloadeddata = null;
      el.oncanplay = null;
      el.onplaying = null;
      el.onerror = null;
      if (frameHandle) {
        if (el.cancelVideoFrameCallback) el.cancelVideoFrameCallback(frameHandle);
        else clearInterval(frameHandle as unknown as number);
      }
      if (watchdog) clearTimeout(watchdog);
    };
  }, [stream]);

  const stop = useCallback(async () => {
    await onStop();
    stopTracks();
  }, [onStop, stopTracks]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className="pipeline-screen">
        <header className="pipeline-screen__header">
          <h2>Share your Screen</h2>
          <p>Pick a screen or window to send. Add an extra mic if needed.</p>
        </header>

        <div className="pipeline-screen__preview">
          <PipelineMedia
            stream={stream}
            onVideoRef={(el) => {
              videoRef.current = el;
            }}
            autoPlay
            muted
            playsInline
            className="pipeline-screen__preview-video"
          />
          <div className="pipeline-screen__preview-label">{screenLabel}</div>
        </div>

        <div className="pipeline-screen__primary">
          <UiButton onClick={startPreview} disabled={busy}>
            SELECT SCREEN TO SHARE
            {/* {JSON.stringify(Boolean(videoRef?.current))} */}
          </UiButton>
          <UiButton onClick={goLive} disabled={busy || !stream || publisherState === "live"}>
            Go Live
          </UiButton>
          <UiButton onClick={stop} disabled={busy && publisherState !== "live"}>
            Stop
          </UiButton>
        </div>

        <div className="pipeline-screen__panel">
          <div className="pipeline-screen__panel-title">Audio Options</div>
          <UiSelect
            options={mics.map((m) => ({ label: m.label || "Microphone", value: m.deviceId }))}
            value={selectedMic ?? undefined}
            onSelect={(val) => {
              const next = normalizeOption(val as string | { value?: string; label?: string });
              if (next) setSelectedMic(next);
            }}
            title={micEnabled ? "Mic" : "Mic muted"}
            variant="gray"
          />
          <UiButton variant={micEnabled ? "secondary" : "primary"} onClick={toggleMicEnabled}>
            {micEnabled ? "Mute Mic" : "Enable Mic"}
          </UiButton>
          <UiButton onClick={addMicrophone} disabled={busy || !micEnabled}>
            Add Microphone Source
          </UiButton>
        </div>

        <div className="pipeline-screen__panel">
          <div className="pipeline-screen__panel-title">Audio Output Destination</div>
          <UiSelect
            options={(outputs.length ? outputs.map((o) => ({ label: o.label, value: o.deviceId })) : [{ label: "Default Device", value: "default" }])}
            title={screenLabel}
            variant="gray"
            onSelect={() => undefined}
          />
        </div>

        <div className="pipeline-screen__panel">
          <div className="pipeline-screen__panel-title">Quality</div>
          <UiSelect
            options={BITRATE_PRESETS.map((b) => ({ label: b.label, value: b.id }))}
            value={bitratePresetId}
            onSelect={(val) => {
              const next = normalizeOption(val as string | { value?: string; label?: string });
              if (next) setBitratePresetId(next);
            }}
            title="Target Bitrate"
            variant="gray"
          />
          <UiButton variant={systemAudio ? "secondary" : "primary"} onClick={toggleSystemAudio}>
            {systemAudio ? "Disable System Audio" : "Enable System Audio"}
          </UiButton>
          <UiButton variant="secondary" onClick={refresh}>
            Refresh devices
          </UiButton>
        </div>

        {viewerUrl && (
          <div className="pipeline-screen__link">
            Viewer link: <a href={viewerUrl}>{viewerUrl}</a>
          </div>
        )}
        {error && <div className="pipeline-screen__error">{error}</div>}
        {micError && !error && <div className="pipeline-screen__error">{micError}</div>}
        {previewNotice && !error && <div className="pipeline-screen__error">{previewNotice}</div>}

        <div className="pipeline-screen__notes">
          <div className="pipeline-screen__panel-title">Things to Note</div>
          <ul>
            <li>Screen audio selection is handled by your browser during sharing.</li>
            <li>You can add a microphone source; it will be mixed with your screen audio.</li>
            <li>Lower quality settings can improve capture smoothness.</li>
            <li>For app-specific audio capture, pick the application window.</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default PipelineScreenShare;