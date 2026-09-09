import React from "react";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import { GuardianFix } from "../hooks/types";
import { iconForDeviceType, parseTimestampValue } from "./vesselCommon";

type BuildTimelineVesselsArgs = {
  timeline?: GuardianFix[];
  viewMode: "live" | "timeline";
  tracking: boolean;
  status: "idle" | "requesting" | "tracking" | "error";
  userName?: string | null;
};

export const buildTimelineVessels = ({
  timeline,
  viewMode,
  tracking,
  status,
  userName,
}: BuildTimelineVesselsArgs): IVessel[] => {
  if (viewMode !== "timeline" || !timeline?.length) return [];
  return timeline.map((point, idx) => {
    const speedText =
      typeof point.speedMph === "number" && Number.isFinite(point.speedMph)
        ? `${point.speedMph.toFixed(1)} mph`
        : "—";
    const timeText = point.timestamp ? new Date(point.timestamp).toLocaleTimeString() : "—";
    const timeLabel =
      tracking && status === "tracking" && idx === timeline.length - 1 ? "Last fix" : "Last active";
    const deviceLabel = point.deviceLabel || point.deviceId || `Point ${idx + 1}`;
    const deviceTypeText = point.deviceType || point.deviceInfo?.deviceType;
    const prev = timeline[idx - 1];
    const lastSeen = parseTimestampValue(point.timestamp ?? point.recordedAt);
    return {
      id: `timeline-${idx}`,
      name:
        idx === timeline.length - 1
          ? `${userName || "You"} · ${deviceLabel} (latest)`
          : `${deviceLabel}`,
      lngLat: [point.longitude, point.latitude],
      className: "guardian__marker",
      icon: iconForDeviceType(deviceTypeText),
      meta: { deviceId: point.deviceId, lastSeen },
      isMain: idx === timeline.length - 1,
      hover: (
        <div className="guardian__marker-hover">
          <div>{userName || "You"}</div>
          <div className="guardian__marker-device">
            <span>{deviceLabel}</span>
            {deviceTypeText ? <span>{deviceTypeText}</span> : null}
          </div>
          <div>
            {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
          </div>
          {point.accuracy != null && <div>± {Math.round(point.accuracy)} m</div>}
          <div>Speed: {speedText}</div>
          <div>
            {timeLabel}: {timeText}
          </div>
        </div>
      ),
      active: tracking && status === "tracking" && idx === timeline.length - 1,
      line:
        idx > 0 && prev?.deviceId === point.deviceId
          ? { color: "#ff9f0c", width: 2, style: "solid" }
          : undefined,
    };
  });
};
