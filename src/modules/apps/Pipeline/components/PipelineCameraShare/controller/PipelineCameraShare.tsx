// Relative Path: ./PipelineCameraShare.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiSelect from "@webstack/components/UiForm/components/UiSelect/UiSelect";
import useSessionStorage from "~/src/webstack/hooks/storage/useSessionStorage";
import useMediaDevices from "~/src/webstack/hooks/media/useMediaDevices";
import PipelineMedia from "../../../views/PipeLineMedia/controller/PipelineMedia";
import { PublishOptions, PublishState } from "../../useWhipPublisher";
import styles from "./PipelineCameraShare.scss";

type Props = {
  busy?: boolean;
  viewerUrl?: string;
  publisherState: PublishState;
  onPublish: (stream: MediaStream, options?: PublishOptions) => Promise<void>;
  onStop: () => Promise<void>;
};

type VideoPreset = {
  id: string;
  label: string;
  constraints: MediaTrackConstraints;
};

type BitratePreset = {
  id: string;
  label: string;
  kbps: number;
};

const VIDEO_PRESETS: VideoPreset[] = [
  { id: "480p30", label: "480p / 30", constraints: { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } },
  { id: "720p30", label: "720p / 30", constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } },
  { id: "1080p30", label: "1080p / 30", constraints: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } },
  { id: "1080p60", label: "1080p / 60", constraints: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } } },
  { id: "balanced", label: "Balanced", constraints: { width: { ideal: 1600 }, height: { ideal: 900 }, frameRate: { ideal: 30 } } },
];

const BITRATE_PRESETS: BitratePreset[] = [
  { id: "low", label: "Low (1.0 Mbps)", kbps: 1000 },
  { id: "med", label: "Medium (2.5 Mbps)", kbps: 2500 },
  { id: "high", label: "High (4.0 Mbps)", kbps: 4000 },
];

const PipelineCameraShare: React.FC<Props> = ({ busy, viewerUrl, publisherState, onPublish, onStop }) => {
  const autoPreviewAttempted = useRef<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camLabel, setCamLabel] = useState<string>("Camera not selected");
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [selectedMic, setSelectedMic] = useState<string | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
  const [videoPresetId, setVideoPresetId] = useState<string>("balanced");
  const [bitratePresetId, setBitratePresetId] = useState<string>("med");
  const [micEnabled, setMicEnabled] = useState<boolean>(true);
  const { cameras, mics, outputs, refresh, loading: devicesLoading } = useMediaDevices();
  const { getSessionItem, setSessionItem } = useSessionStorage();
  const selectedCameraLabel = useMemo(
    () => cameras.find((c) => c.deviceId === selectedCamera)?.label,
    [cameras, selectedCamera]
  );

  const resolveCameraLabel = useCallback(
    (media?: MediaStream | null) => {
      const trackLabel = media?.getVideoTracks()[0]?.label;
      if (trackLabel) return trackLabel;
      if (selectedCameraLabel) return selectedCameraLabel;
      return media ? "Camera selected" : "Camera not selected";
    },
    [selectedCameraLabel]
  );

  const stopTracks = useCallback(() => {
    // Use functional update so we stop the latest stream without resetting immediately on dependency changes
    setStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);

  useEffect(() => () => stopTracks(), [stopTracks]);

  // hydrate selections from session storage when devices are known
  useEffect(() => {
    if (devicesLoading) return;
    const storedCam = getSessionItem("pipeline:camera")?.value;
    const storedMic = getSessionItem("pipeline:mic")?.value;
    const storedOut = getSessionItem("pipeline:output")?.value;
    const storedPreset = getSessionItem("pipeline:videoPreset")?.value;
    const storedBitrate = getSessionItem("pipeline:bitratePreset")?.value;
    const storedMicEnabled = getSessionItem("pipeline:micEnabled")?.value;

    const cameraExists = selectedCamera ? cameras.some((c) => c.deviceId === selectedCamera) : false;
    const micExists = selectedMic ? mics.some((m) => m.deviceId === selectedMic) : false;
    const outputExists = selectedOutput ? outputs.some((o) => o.deviceId === selectedOutput) : false;

    if (!selectedCamera || !cameraExists) {
      const matchCam = cameras.find((c) => c.deviceId === storedCam)?.deviceId || cameras[0]?.deviceId || null;
      setSelectedCamera(matchCam);
      if (matchCam !== selectedCamera) setSessionItem("pipeline:camera", { value: matchCam });
    }
    if (!selectedMic || !micExists) {
      const matchMic = mics.find((m) => m.deviceId === storedMic)?.deviceId || mics[0]?.deviceId || null;
      setSelectedMic(matchMic);
      if (matchMic !== selectedMic) setSessionItem("pipeline:mic", { value: matchMic });
    }
    if ((!selectedOutput || !outputExists) && outputs.length) {
      const matchOut = outputs.find((o) => o.deviceId === storedOut)?.deviceId || outputs[0]?.deviceId || null;
      setSelectedOutput(matchOut);
      if (matchOut !== selectedOutput) setSessionItem("pipeline:output", { value: matchOut });
    }
    if (storedPreset && VIDEO_PRESETS.some((p) => p.id === storedPreset)) {
      setVideoPresetId(storedPreset);
    }
    if (storedBitrate && BITRATE_PRESETS.some((b) => b.id === storedBitrate)) {
      setBitratePresetId(storedBitrate);
    }
    if (typeof storedMicEnabled === "boolean") setMicEnabled(storedMicEnabled);
  }, [
    cameras,
    devicesLoading,
    getSessionItem,
    mics,
    outputs,
    selectedCamera,
    selectedMic,
    selectedOutput,
    setSessionItem,
  ]);

  const videoPreset = useMemo(
    () => VIDEO_PRESETS.find((p) => p.id === videoPresetId) ?? VIDEO_PRESETS.find((p) => p.id === "balanced")!,
    [videoPresetId]
  );
  const bitratePreset = useMemo(
    () => BITRATE_PRESETS.find((b) => b.id === bitratePresetId) ?? BITRATE_PRESETS[1],
    [bitratePresetId]
  );

  const startPreview = useCallback(
    async (opts?: { presetId?: string; allowFallback?: boolean; loosen?: boolean }) => {
      setError(null);
      const targetPresetId = opts?.presetId ?? videoPresetId;
      console.log("[Pipeline] starting preview with preset (targetPresetId)", targetPresetId);
      const preset = VIDEO_PRESETS.find((p) => p.id === targetPresetId) ?? videoPreset;
      const allowFallback = opts?.allowFallback ?? true;
      const loosen = opts?.loosen ?? false;
      const targetCameraId = selectedCamera ?? cameras[0]?.deviceId ?? null;

      try {
        stopTracks();
        const constraints: MediaStreamConstraints = {
          video: {
            ...(preset?.constraints ?? {}),
            ...(loosen ? {} : { deviceId: targetCameraId ? { exact: targetCameraId } : undefined }),
          },
          audio: micEnabled
            ? {
              deviceId: selectedMic ? { exact: selectedMic } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
            : false,
        };

        const media = await navigator.mediaDevices.getUserMedia(constraints);
        const track = media.getVideoTracks()[0];
        setStream(media);
        const deviceId = track?.getSettings?.().deviceId;
        const effectiveCameraId = deviceId ?? targetCameraId ?? selectedCamera;
        if (effectiveCameraId && effectiveCameraId !== selectedCamera) {
          setSelectedCamera(effectiveCameraId);
        }
        setCamLabel(track?.label ?? resolveCameraLabel(media));
        setSessionItem("pipeline:camera", { value: effectiveCameraId ?? null });
        setSessionItem("pipeline:mic", { value: selectedMic });
        setSessionItem("pipeline:videoPreset", { value: targetPresetId });
        setSessionItem("pipeline:bitratePreset", { value: bitratePresetId });
        setSessionItem("pipeline:micEnabled", { value: micEnabled });
        setSessionItem("pipeline:camera:autoPreview", { value: true });
        if (selectedOutput) setSessionItem("pipeline:output", { value: selectedOutput });
        refresh();
        console.debug("[Pipeline] camera selected", track?.label, constraints);
      } catch (err: any) {
        const name = err?.name;
        if (name === "NotFoundError") {
          if (micEnabled) {
            try {
              const fallback = await navigator.mediaDevices.getUserMedia({
                video: {
                  ...(preset?.constraints ?? {}),
                  deviceId: loosen ? undefined : targetCameraId ? { exact: targetCameraId } : undefined,
                },
                audio: false,
              });
              setStream(fallback);
              setMicEnabled(false);
              setSessionItem("pipeline:micEnabled", { value: false });
              setError("Microphone not found. Previewing without mic.");
              refresh();
              return;
            } catch (fallbackErr) {
              console.error("[Pipeline] fallback preview failed", fallbackErr);
            }
          }
          setError("Camera not found. Trying any available camera.");
          setSelectedCamera(null);
          setSessionItem("pipeline:camera", { value: null });
          autoPreviewAttempted.current = false;
          await startPreview({ presetId: targetPresetId, allowFallback: false, loosen: true });
          return;
        } else if (name === "OverconstrainedError") {
          if (allowFallback && targetPresetId !== "balanced") {
            setError("Video constraints not supported. Switching to Balanced preset.");
            setVideoPresetId("balanced");
            await startPreview({ presetId: "balanced", allowFallback: false });
            return;
          }
          if (allowFallback && selectedCamera) {
            setError("Video constraints not supported. Trying default camera settings.");
            await startPreview({ presetId: targetPresetId, allowFallback: false, loosen: true });
            return;
          }
          if (allowFallback) {
            setError("Video constraints not supported. Trying safest settings.");
            try {
              const minimal = await navigator.mediaDevices.getUserMedia({ video: true, audio: micEnabled ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false });
              setStream(minimal);
              setCamLabel(resolveCameraLabel(minimal));
              setSessionItem("pipeline:camera:autoPreview", { value: true });
              setError(null);
              return;
            } catch (innerErr) {
              console.error("[Pipeline] minimal constraints failed", innerErr);
            }
          }
          setError("Video constraints not supported. Try a lower preset.");
        } else if (name === "NotAllowedError") {
          setError("Permission blocked. Allow camera/mic access to preview.");
          setSessionItem("pipeline:camera:autoPreview", { value: false });
        } else {
          setError(err?.message ?? "Unable to access camera");
        }
        console.error("[Pipeline] getUserMedia camera failed", err);
      }
    },
    [
      bitratePresetId,
      cameras,
      micEnabled,
      resolveCameraLabel,
      selectedCamera,
      selectedMic,
      selectedOutput,
      refresh,
      setSessionItem,
      stopTracks,
      videoPreset,
      videoPresetId,
    ]
  );

  const normalizeOption = (val: string | { value?: string; label?: string } | null | undefined) =>
    typeof val === "string" ? val : val?.value;

  const handleCameraChange = useCallback(
    (val: string | { value?: string; label?: string }) => {
      const next = normalizeOption(val);
      if (!next) return;
      setSelectedCamera(next);
      setError(null);
      stopTracks();
      autoPreviewAttempted.current = false;
      setSessionItem("pipeline:camera", { value: next });
    },
    [normalizeOption, setSessionItem, stopTracks]
  );

  const handleMicChange = useCallback((val: string | { value?: string; label?: string }) => {
    const next = normalizeOption(val);
    if (!next) return;
    setSelectedMic(next);
    setError(null);
    setSessionItem("pipeline:mic", { value: next });
  }, [normalizeOption, setSessionItem]);

  const handleVideoPresetChange = useCallback(
    (val: string | { value?: string; label?: string }) => {
      const next = normalizeOption(val);
      if (!next) return;
      console.debug("[Pipeline] video preset changed", val);
      setVideoPresetId(next);
      setError(null);
      stopTracks();
      autoPreviewAttempted.current = false;
      setSessionItem("pipeline:videoPreset", { value: next });
    },
    [normalizeOption, setSessionItem, stopTracks]
  );

  const handleOutputChange = useCallback((val: string | { value?: string; label?: string }) => {
    const next = normalizeOption(val);
    if (!next) return;
    console.debug("[Pipeline] output changed", val);
    setSelectedOutput(next);
    setError(null);
    setSessionItem("pipeline:output", { value: next });
  }, [normalizeOption, setSessionItem]);

  const handleBitrateChange = useCallback((val: string | { value?: string; label?: string }) => {
    const next = normalizeOption(val);
    if (!next) return;
    setBitratePresetId(next);
    setSessionItem("pipeline:bitratePreset", { value: next });
  }, [normalizeOption, setSessionItem]);

  const goLive = useCallback(async () => {
    if (!stream) return;
    setError(null);
    try {
      console.debug("[Pipeline] starting camera publish", {
        tracks: stream.getTracks().map((t) => ({ kind: t.kind, label: t.label })),
        bitratePreset: bitratePresetId,
      });
      await onPublish(stream, { maxBitrateKbps: bitratePreset?.kbps });
    } catch (err: any) {
      setError(err?.message ?? "Failed to start stream");
      console.error("[Pipeline] publish failed", err);
    }
  }, [bitratePreset?.kbps, bitratePresetId, onPublish, stream]);

  const toggleMicEnabled = useCallback(() => {
    setMicEnabled((prev) => {
      const next = !prev;
      setSessionItem("pipeline:micEnabled", { value: next });
      return next;
    });
  }, [setSessionItem]);

  useEffect(() => {
    if (!stream) return;
    setCamLabel(resolveCameraLabel(stream));
  }, [resolveCameraLabel, stream]);

  useEffect(() => {
    if (stream) return;
    if (!selectedCameraLabel) return;
    setCamLabel(selectedCameraLabel);
  }, [selectedCameraLabel, stream]);

  useEffect(() => {
    if (devicesLoading || busy || stream) return;
    if (autoPreviewAttempted.current) return;
    const autoPreview = getSessionItem("pipeline:camera:autoPreview")?.value;
    const autoPreviewEnabled = typeof autoPreview === "boolean" ? autoPreview : true; // default to on across refreshes
    const hasCamera = selectedCamera || cameras[0]?.deviceId;
    if (!autoPreviewEnabled || !hasCamera) return;
    autoPreviewAttempted.current = true;
    if (!selectedCamera && cameras[0]?.deviceId) {
      setSelectedCamera(cameras[0].deviceId);
    }
    startPreview().catch((err) => console.error("[Pipeline] auto preview failed", err));
  }, [busy, cameras, devicesLoading, getSessionItem, selectedCamera, startPreview, stream]);

  const stop = useCallback(async () => {
    await onStop();
    stopTracks();
  }, [onStop, stopTracks]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className="pipeline-camera">
        <div className="pipeline-camera__preview">
          <PipelineMedia stream={stream} className="pipeline-camera__preview-video" />
          <div className="pipeline-camera__preview-label">{camLabel}</div>
        </div>
        <div className="pipeline-camera__actions">
          <UiButton name="preview-camera" onClick={startPreview} disabled={busy}>
            Preview Camera
          </UiButton>
          <UiButton name="go-live" onClick={goLive} disabled={busy || !stream || publisherState === "live"}>
            Go Live
          </UiButton>
          <UiButton name="stop" onClick={stop} disabled={busy && publisherState !== "live"}>
            Stop
          </UiButton>
        </div>

        <div className="pipeline-camera__panels">
          <div className="pipeline-camera__panel">
            <div className="pipeline-camera__panel-title">Video Source</div>
            <UiSelect
              options={cameras.map((c) => ({ label: c.label || "Camera", value: c.deviceId }))}
              value={selectedCamera ?? undefined}
              onSelect={(val) => handleCameraChange(val as string)}
              title={selectedCamera ? "Camera" : devicesLoading ? "Loading devices..." : "Select camera"}
              variant="gray"
            />
            <UiSelect
              options={VIDEO_PRESETS.map((p) => ({ label: p.label, value: p.id }))}
              value={videoPresetId}
              onSelect={(val) => handleVideoPresetChange(val as string)}
              title="Resolution"
              variant="gray"
            />
          </div>

          <div className="pipeline-camera__panel">
            <div className="pipeline-camera__panel-title">Audio Source</div>
            <UiSelect
              options={mics.map((m) => ({ label: m.label || "Microphone", value: m.deviceId }))}
              value={selectedMic ?? undefined}
              onSelect={(val) => handleMicChange(val as string)}
              title={micEnabled ? "Mic" : "Mic muted"}
              variant="gray"
            />
            <UiButton name="toggle-mic" variant={micEnabled ? "flat" : "min"} onClick={toggleMicEnabled}>
              {micEnabled ? "Mute Mic" : "Enable Mic"}
            </UiButton>
          </div>

          <div className="pipeline-camera__panel">
            <div className="pipeline-camera__panel-title">Bitrate</div>
            <UiSelect
              options={BITRATE_PRESETS.map((b) => ({ label: b.label, value: b.id }))}
              value={bitratePresetId}
              onSelect={(val) => handleBitrateChange(val as string)}
              title="Target Bitrate"
              variant="gray"
            />
            <UiSelect
              options={outputs.map((o) => ({ label: o.label || "Output", value: o.deviceId }))}
              value={selectedOutput ?? undefined}
              onSelect={(val) => handleOutputChange(val as string)}
              title="Audio Output"
              variant="gray"
            />
            <UiButton name="refresh-devices" variant="flat" onClick={refresh}>
              Refresh devices
            </UiButton>
          </div>
        </div>
        {viewerUrl && (
          <div className="pipeline-camera__link">
            Viewer link: <a href={viewerUrl}>{viewerUrl}</a>
          </div>
        )}
        {error && <div className="pipeline-camera__error">{error}</div>}
      </div>
    </>
  );
};

export default PipelineCameraShare;
