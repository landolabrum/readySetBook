// Relative Path: ./GuardianView.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import UiMap from "@webstack/components/ThreeComponents/UiMap/controller/UiMap";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import { GuardianFix, GuardianViewMode } from "../../hooks/useGuardian";
import styles from "./GuardianView.scss";
import useWindow from "@webstack/hooks/window/useWindow";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";

type Props = {
  mapCenter?: [number, number];
  fallbackVessels?: IVessel[];
  mapZoom?: number;
  vessels: IVessel[];
  lastFix?: GuardianFix;
  mode: GuardianViewMode;
  timelineCount?: number;
  timelineWindowLabel?: string;
  uploadIntervalSec: number;
  devices?: GuardianFix[];
  deviceLabel?: string;
  deviceType?: string;
  deviceId?: string;
  mapOrientation?: "north" | "heading";
  headingDirection?: number;
  tracking: boolean;
  onStartTracking: () => void;
  onStopTracking: () => void;
  /** Hide overlays and tracking controls for a clean embed */
  minimal?: boolean;
  /** Force a fullscreen map container */
  fullscreen?: boolean;
  onUserMapInteract?: () => void;
  onRecenter: () => void;
  canRecenter?: boolean;
  autoFollow?: boolean;
};

const GuardianView: React.FC<Props> = ({
  mapCenter,
  fallbackVessels = [],
  mapZoom,
  vessels,
  lastFix,
  mode,
  timelineCount,
  timelineWindowLabel,
  uploadIntervalSec,
  devices,
  deviceLabel,
  deviceType,
  deviceId,
  mapOrientation = "north",
  headingDirection,
  tracking,
  onStartTracking,
  onStopTracking,
  minimal = false,
  fullscreen = false,
  onUserMapInteract,
  onRecenter,
  canRecenter = false,
  autoFollow = true,
}) => {
  const { width, height } = useWindow();
  const speedText =
    lastFix && typeof lastFix.speedMph === "number" && Number.isFinite(lastFix.speedMph)
      ? `${lastFix.speedMph.toFixed(1)} mph`
      : "0 mph";
  const timeBasis = lastFix?.displayTimestamp ?? lastFix?.timestamp;
  const timeText = timeBasis ? new Date(timeBasis).toLocaleTimeString() : "—";
  const sortedDevices = devices?.length
    ? [...devices].sort((a, b) => b.timestamp - a.timestamp)
    : [];
  const activeDevice = sortedDevices?.[0];
  const primaryDeviceLabel =
    deviceLabel ||
    activeDevice?.deviceLabel ||
    activeDevice?.deviceId ||
    deviceId ||
    (sortedDevices.length ? "Device" : "—");
  const primaryDeviceType =
    deviceType || activeDevice?.deviceType || activeDevice?.deviceInfo?.deviceType;

  const requestedBearing =
    mapOrientation === "heading" && typeof headingDirection === "number" ? headingDirection : 0;

  const isMobile = width != null && width <= 900;
  const isLandscape = isMobile && height != null && width > height;
  const [overlayAwake, setOverlayAwake] = useState(true);
  const overlayTimerRef = useRef<number | null>(null);
  const scheduleOverlayFade = useCallback(() => {
    if (!isMobile || typeof window === "undefined") return;
    setOverlayAwake(true);
    if (overlayTimerRef.current) {
      window.clearTimeout(overlayTimerRef.current);
    }
    overlayTimerRef.current = window.setTimeout(() => {
      setOverlayAwake(false);
    }, 1600);
  }, [isMobile]);
  useEffect(() => {
    if (!isMobile) return undefined;
    scheduleOverlayFade();
    return () => {
      if (overlayTimerRef.current) {
        window.clearTimeout(overlayTimerRef.current);
      }
    };
  }, [isMobile, scheduleOverlayFade]);
  const handleInteraction = useCallback(() => {
    scheduleOverlayFade();
  }, [scheduleOverlayFade]);
  const overlayStyle: React.CSSProperties | undefined = isMobile
    ? ({ "--guardian-overlay-opacity": overlayAwake ? 0.95 : 0.35 } as React.CSSProperties)
    : undefined;
  const overlayStateClass = overlayAwake ? "is-visible" : "is-faded";
  const showHud = !minimal && isMobile && isLandscape;
  const showMeta = !minimal;
  const showFab = !minimal && isMobile;
  const manualMapControl = showFab && !autoFollow;
  const mapVariant = fullscreen ? "fullscreen" : width > 1100 ? "embedded" : "fullscreen";
  const mapRefreshToken =
    mode === "timeline"
      ? `${timelineCount ?? 0}-${vessels?.length ?? 0}-${
          vessels?.[vessels.length - 1]?.lngLat?.join(",") || mapCenter?.join(",") || "none"
        }`
      : null;
  const mapClasses = [
    "guardian__map",
    isMobile ? "guardian__map--mobile" : "",
    fullscreen ? "guardian__map--fullscreen" : "",
    minimal ? "guardian__map--minimal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <style jsx>{styles}</style>
      <section
        className={mapClasses}
        style={overlayStyle}
        onPointerDown={isMobile ? handleInteraction : undefined}
        onTouchStart={isMobile ? handleInteraction : undefined}
      >
        {showMeta ? (
          <div className="guardian__map-meta">
            <div>
              <strong>Mode:</strong> {mode === "timeline" ? "Timeline" : "Live tracking"}
            </div>

            <div>
              <strong>Last fix:</strong> {timeText}
            </div>
            <div>
              <strong>Active device:</strong> {primaryDeviceLabel}
              {primaryDeviceType ? ` (${primaryDeviceType})` : ""}
            </div>
            <div>
              <strong>Devices online:</strong> {devices?.length ?? 0}
            </div>
            {mode === "timeline" && (
              <div>
                <strong>Timeline points:</strong> {timelineCount ?? 0}
                <div className="guardian__map-meta-subtle">{timelineWindowLabel || "Last 24h"}</div>
              </div>
            )}
            <div>
              <strong>Upload rate:</strong> every {uploadIntervalSec}s
            </div>
          </div>
        ) : null}
        <UiMap
          // onVesselClick={console.log}
          variant={mapVariant}
          options={{
            center: mapCenter ?? (fallbackVessels[0]?.lngLat as [number, number]) ?? ([0, 0] as [number, number]),
            zoom: mapZoom ?? (mapCenter || fallbackVessels.length ? 15 : 2),
            tools: false,
            bearing: requestedBearing,
          }}
          vessels={vessels}
          onUserInteraction={onUserMapInteract}
          refreshToken={mapRefreshToken}
        />
        {/* {showHud && (
          <div className={`guardian__mobile-hud ${overlayStateClass}`} aria-live="polite">
            <span>Speed: {speedText}</span>
            <span>{mode === "timeline" ? "Timeline" : "Live tracking"}</span>
          </div>
        )} */}
        {showFab && (
          <div className={`guardian__mobile-fab-group ${overlayStateClass}`}>
            <div
              className={`guardian__mobile--speed guardian__mobile-fab--speed ${manualMapControl ? "is-manual" : ""}`}
            >
               {speedText}
            </div>
            <button
              type="button"
              className={`guardian__mobile-fab guardian__mobile-fab--recenter ${manualMapControl ? "is-manual" : ""}`}
              onClick={onRecenter}
              disabled={!canRecenter}
              aria-label="Recenter on me"
            >
              <UiIcon icon="fa-crosshairs" />
            </button>
            <button
              type="button"
              className={`guardian__mobile-fab guardian__mobile-fab--tracking ${tracking ? "is-tracking" : ""}`}
              onClick={() => (tracking ? onStopTracking() : onStartTracking())}
              aria-label={tracking ? "Stop tracking" : "Start tracking"}
            >
              <UiIcon icon={tracking ? "fa-stop" : "fa-play"} />
            </button>
          </div>
        )}
      </section>
    </>
  );
};

export default GuardianView;
