import React from "react";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiWeather from "@webstack/components/Widgets/Weather/UiWeather";
import UiSelect from "@webstack/components/UiForm/components/UiSelect/UiSelect";
import panelStyles from "./GuardianPanel.scss";
import layoutStyles from "../../controller/Guardian.scss";
import { GuardianFix } from "../../hooks/useGuardian";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";

type Props = {
  heading?: string;
  subtitle?: string;
  lastFix?: GuardianFix;
  tracking: boolean;
  onToggleTracking: () => void;
  onRecenter: () => void;
  canRecenter?: boolean;
  deviceInfo?: any;
  deviceId?: string;
  deviceLabel?: string;
  deviceType?: string;
  shareUrl: string;
  shareDeviceId?: string | null;
  onShareDeviceChange?: (id: string) => void;
  devices?: GuardianFix[];
  visibleVessels?: IVessel[];
  clearanceLevel?: number;
  trackingResumePending?: boolean;
};

type GuardianVesselMeta = {
  deviceId?: string;
  deviceLabel?: string;
  displayName?: string;
  userId?: string;
};

const GuardianHeader: React.FC<Props> = ({
  heading = "Stay in sync with your live location",
  subtitle = "Stream your position to Mindburn in near real time and keep your map centered on you.",
  lastFix,
  tracking,
  onToggleTracking,
  onRecenter,
  canRecenter,
  deviceInfo,
  deviceId,
  deviceLabel,
  deviceType,
  shareUrl,
  shareDeviceId,
  onShareDeviceChange,
  devices,
  visibleVessels,
  clearanceLevel,
  trackingResumePending,
}) => {
  const trackingActive = tracking || trackingResumePending;
  // const weatherPoint: [number, number] | undefined =
  //   lastFix?.latitude != null && lastFix?.longitude != null
  //     ? [lastFix.longitude, lastFix.latitude]
  //     : undefined;
  const canRecenterResolved = canRecenter ?? (Boolean(lastFix) || Boolean(devices?.length));
  const clearanceLevelResolved = clearanceLevel ?? 0;
  const shareDeviceOptions = React.useMemo(() => {
    const options = new Map<string, { label: string; value: string }>();
    const addOption = (opt?: { label?: string; value?: string }) => {
      const value = (opt?.value || "").trim();
      if (!value || options.has(value)) return;
      options.set(value, {
        value,
        label: opt?.label || value,
      });
    };

    (devices || []).forEach((dev) => {
      addOption({
        label: dev.deviceLabel || dev.deviceId || "Device",
        value: dev.deviceId || dev.deviceLabel || "",
      });
    });

    if (clearanceLevelResolved >= 12 && visibleVessels?.length) {
      visibleVessels.forEach((vessel) => {
        const meta = (vessel as IVessel & { meta?: GuardianVesselMeta }).meta;
        const deviceId = meta?.deviceId ?? meta?.deviceLabel ?? meta?.userId ?? "";
        if (!deviceId) return;
        const labelParts: string[] = [];
        if (meta?.displayName) labelParts.push(meta.displayName);
        if (meta?.deviceLabel) labelParts.push(meta.deviceLabel);
        if (!labelParts.length && vessel.name) labelParts.push(vessel.name);
        addOption({
          value: deviceId,
          label: labelParts.join(" · ") || deviceId,
        });
      });
    }

    return Array.from(options.values());
  }, [devices, visibleVessels, clearanceLevelResolved]);

  React.useEffect(() => {
    if (shareDeviceId) return;
    const fallback = shareDeviceOptions[0]?.value;
    if (fallback) {
      onShareDeviceChange?.(fallback);
    }
  }, [shareDeviceOptions, shareDeviceId, onShareDeviceChange,]);
  const effectiveShareDevice = shareDeviceId || shareDeviceOptions[0]?.value;

  return (
    <>
      <style jsx>{layoutStyles}</style>
      <style jsx>{panelStyles}</style>
      <header>
        Clearance: {clearanceLevel}
        <p className="eyebrow des">Guardian GPS</p>
        <h1 className="desktop-only">{heading}</h1>
        {/* {weatherPoint && <UiWeather summary lngLat={weatherPoint} />} */}
        <p className="lede">{subtitle}</p>
        {deviceInfo && (
          <div className="guardian__agent">
            <div>
              <strong>Device:</strong> {deviceLabel || deviceId || "This device"}
              {deviceType ? ` · ${deviceType}` : ""}
            </div>
            {(deviceInfo.platform || deviceInfo.language) && (
              <div className="guardian__agent-meta">
                {deviceInfo.platform || "Unknown platform"} · {deviceInfo.language || "lang —"}
              </div>
            )}
            {deviceInfo.userAgent && <div className="guardian__agent-ua">{deviceInfo.userAgent}</div>}
          </div>
        )}
        <div className="guardian__share">
          {shareUrl && (
            <div className="guardian__share-link">
              <UiButton
                label={shareUrl}
                variant="dark"
                traits={{
                  afterIcon: {
                    icon: "fa-copy",
                    onClick: (e: any) => { e.stopPropagation(); navigator.clipboard.writeText(shareUrl); }
                  }
                }}
                href={shareUrl}>Share My Location:</UiButton>

              {/* <UiIcon  onClick={() => navigator.clipboard.writeText(shareUrl)} /> */}
              {shareDeviceOptions.length ? (

                <UiSelect
                  label="Share device"
                  value={effectiveShareDevice}
                  options={shareDeviceOptions}
                  onSelect={(opt: any) => onShareDeviceChange?.(opt?.value || "")}
                />
              ) : null}
            </div>
          )}
          {trackingResumePending && (
            <div className="guardian__tracking-hint">
              Location sharing will resume automatically once permission is re-granted.
            </div>
          )}
        </div>
        <div className="guardian__actions">
          <UiButton
            label="panel tracking state"
            variant={trackingActive ? "danger" : "primary"}
            onClick={onToggleTracking}
            aria-pressed={trackingActive}
          >
            {trackingActive ? "Stop Tracking" : "Start Tracking"}
          </UiButton>
          <UiButton variant={canRecenterResolved ? "flat" : "disabled"} onClick={onRecenter}
            disabled={!canRecenterResolved}>
            {canRecenterResolved ? "Recenter on Me" : "Cannot Recenter"}
          </UiButton>
        </div>
      </header>
    </>
  );
};

export default GuardianHeader;
