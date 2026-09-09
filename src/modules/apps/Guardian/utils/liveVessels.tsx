import React from "react";
import UiList from "@webstack/components/UiList/UiList";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import { GuardianFix } from "../hooks/types";
import { iconForDeviceType, parseTimestampValue } from "./vesselCommon";
import { buildVesselKey, dedupeVessels } from "./vesselKeys";

type GuardianStatus = "idle" | "requesting" | "tracking" | "error";

const RECENT_TRACKING_WINDOW_MS = 3 * 60 * 1000;

type BuildLiveVesselsArgs = {
  devices?: GuardianFix[];
  lastFix?: GuardianFix | null;
  tracking: boolean;
  status: GuardianStatus;
  userName?: string | null;
  lookupVessel?: IVessel | null;
  allVessels?: IVessel[];
  shareDeviceId?: string | null;
  activeDeviceId?: string | null;
};

export const buildLiveVessels = ({
  devices,
  lastFix,
  tracking,
  status,
  userName,
  lookupVessel,
  allVessels,
  shareDeviceId,
  activeDeviceId,
}: BuildLiveVesselsArgs): IVessel[] => {
  const isTracking = tracking && status === "tracking";
  const list: IVessel[] = [];
  const devicePoints = devices?.length
    ? [...devices].sort((a, b) => b.timestamp - a.timestamp)
    : lastFix
      ? [lastFix]
      : [];

  devicePoints.forEach((fix, idx) => {
    const deviceId = fix.deviceId || fix.deviceLabel || `device-${idx}`;
    const deviceLabel = fix.deviceLabel || fix.deviceId || (idx === 0 ? "This device" : `Device ${idx + 1}`);
    const deviceTypeText = fix.deviceType || fix.deviceInfo?.deviceType;
    const lastSeenValue =
      fix.displayTimestamp ??
      fix.timestamp ??
      fix.recordedAt ??
      (fix as GuardianFix & { recorded_at?: number }).recorded_at;
    const lastSeen = parseTimestampValue(lastSeenValue);
    const matchesShareId = (value?: string) => Boolean(value && shareDeviceId && value === shareDeviceId);
    const isShareMain = Boolean(shareDeviceId) && (matchesShareId(fix.deviceId) || matchesShareId(fix.deviceLabel));
    const isActiveDevice = Boolean(activeDeviceId) && deviceId === activeDeviceId;
    const isMain = isShareMain || isActiveDevice;
    const liveIcon = isShareMain ? "fa-user-shield" : iconForDeviceType(deviceTypeText);
    const now = Date.now();
    const isRecentFix = typeof lastSeen === "number" && now - lastSeen < RECENT_TRACKING_WINDOW_MS;
    const isMainActive = isActiveDevice && isTracking && isRecentFix;
    const activeMarker = isMainActive;
    const speedLabel =
      typeof fix.speedMph === "number" && Number.isFinite(fix.speedMph)
        ? `${fix.speedMph.toFixed(1)} mph`
        : "—";
    const vesselMeta = {
      displayName: userName || "You",
      userName: userName || "You",
      userId: fix.userId,
      deviceId,
      deviceLabel,
      deviceType: deviceTypeText,
      lastSeen,
      recordedAt: lastSeen,
      latitude: fix.latitude,
      longitude: fix.longitude,
      speed: speedLabel,
      speedMph: fix.speedMph,
      isTracking: activeMarker,
      isCurrent: isMainActive,
    };
    const vesselKey = buildVesselKey(vesselMeta, `guardian-${deviceId}`);
    list.push({
      id: vesselKey,
      name: `${userName || "You"} · ${deviceLabel}`,
      lngLat: [fix.longitude, fix.latitude],
      className: "guardian__marker",
      active: activeMarker,
      icon: liveIcon,
      meta: vesselMeta,
      isMain,
      hover: (
        <div className="guardian__marker-hover">
          <UiList
            variant="mini"
            items={[
              { name: "user", title: "user", label: userName || "You" },
              { name: "device", title: "device", label: deviceLabel || fix.deviceId || `Device ${idx + 1}` },
              { name: "deviceType", title: "deviceType", label: deviceTypeText || "—" },
              {
                name: "latLng",
                title: "latLng",
                label:
                  fix?.latitude && fix?.longitude
                    ? `${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`
                    : "—",
              },
              { name: "lastSeen", title: "lastSeen", label: lastSeen ? new Date(lastSeen).toLocaleTimeString() : "—" },
              { name: "speed", title: "speed", label: speedLabel },
            ]}
          />
        </div>
      ),
    });
  });

  if (lookupVessel) list.push(lookupVessel);
  const combined = [...(allVessels || []), ...list];
  return dedupeVessels(combined);
};
