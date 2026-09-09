import React from "react";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import { formatRelativeTime, iconForDeviceType, parseTimestampValue } from "./vesselCommon";
import { buildVesselKey, dedupeVessels } from "./vesselKeys";
import { normalizeDeviceIdentifier, normalizeDeviceLabel } from "../hooks/tracker/helpers";

export const buildLookupVessels = (rows: any[]): IVessel[] =>
  dedupeVessels(
    rows
      .filter((row: any) => row?.latitude != null && row?.longitude != null)
      .map((row: any, i: number) => {
        const lat = Number(row.latitude);
        const lon = Number(row.longitude);
        const deviceIdRaw = row.device_id || row.deviceId;
        const userId = row.user_id || row.userId || row.friend_user_id || row.friendUserId || "user";
        const deviceLabelRaw = row.device_label || row.deviceLabel || deviceIdRaw || `device-${i + 1}`;
        const deviceId = normalizeDeviceIdentifier(deviceIdRaw || deviceLabelRaw) || deviceIdRaw || deviceLabelRaw;
        const deviceLabel = normalizeDeviceLabel(deviceLabelRaw) || deviceId || deviceLabelRaw;
        const deviceType = row.device_type || row.deviceType || row.device_info?.deviceType;
        const displayName = row.friend_display_name || row.displayName || userId;
        const lastSeen = parseTimestampValue(row.recorded_at ?? row.recordedAt ?? row.timestamp ?? row.last_seen);
        const meta = {
          userId,
          displayName,
          deviceId,
          deviceLabel,
          deviceType,
          lastSeen,
          latitude: lat,
          longitude: lon,
        };
        const vesselKey = buildVesselKey(meta, `${userId}-${deviceId || i}`);
        return {
          id: vesselKey,
          meta,
          name: `${displayName} · ${deviceLabel}`,
          lngLat: [lon, lat] as [number, number],
          icon: iconForDeviceType(deviceType),
          hover: (
            <div className="guardian__marker-hover">
              <div className="guardian__marker-hover-title">{displayName || userId || deviceId || "Device"}</div>
              <div className="guardian__marker-hover-body">
                <div className="guardian__marker-hover-row">
                  <span>User ID:</span>
                  <strong>{userId}</strong>
                </div>
                <div className="guardian__marker-hover-row">
                  <span>Device ID:</span>
                  <strong>{deviceId || "—"}</strong>
                  {deviceType ? (
                    <>
                      <span className="guardian__marker-hover-divider"> · </span>
                      <span>Type:</span>
                      <strong>{deviceType}</strong>
                    </>
                  ) : null}
                </div>
                <div className="guardian__marker-hover-row">
                  <span>Location:</span>
                  <strong>
                    {lat.toFixed(5)}, {lon.toFixed(5)}
                  </strong>
                </div>
                <div className="guardian__marker-hover-row">
                  <span>Last seen:</span>
                  <strong>{formatRelativeTime(lastSeen)}</strong>
                </div>
              </div>
            </div>
          ),
        };
      })
  );
