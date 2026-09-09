// Relative Path: ./FleetSystemsDevicesMap.tsx
import React, { useEffect, useMemo, useRef } from "react";
import type { HostRow } from "../../../../helpers/types";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import GuardianView from "~/src/modules/apps/Guardian/views/GuardianView/GuardianView";
import useLocationPermissions from "@webstack/hooks/user/useLocationPermissions";

type Props = {
  hosts: HostRow[];
};

const noop = () => undefined;

const hostVessel = (h: HostRow): IVessel | null => {
  // Explicit null check first — Number(null) coerces to 0, which would put
  // geo-less hosts at [0, 0] and drag the centroid into the Atlantic.
  if (h.latitude == null || h.longitude == null) return null;
  const lat = Number(h.latitude);
  const lon = Number(h.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const name = h.display_name || h.host_key;
  const lanIp = h?.extra?.lan_ip || h.ssh_ip || h.host_lan_ip;
  const wanIp = h?.extra?.wan_ip;
  return {
    id: h.host_key,
    // active:h.has,
    name,
    lngLat: [lon, lat] as [number, number],
    icon: "fa-server",
    className: "guardian__marker guardian__marker--fleet",
    meta: {
      source: "fleet",
      deviceId: h.host_key,
      deviceLabel: name,
      deviceType: h.device_class || h.role || "fleet",
      userId: h.owner_user_id || "fleet",
      displayName: name,
      lastSeen: h.ts ? new Date(h.ts).getTime() : undefined,
      latitude: lat,
      longitude: lon,
    },
    hover: (
      <div className="guardian__marker-hover">
        <div className="guardian__marker-hover-title">{name}</div>
        <div className="guardian__marker-hover-body">
          <div className="guardian__marker-hover-row">
            <span>Role:</span>
            <strong>{h.role || "—"}</strong>
            {h.device_class ? (
              <>
                <span className="guardian__marker-hover-divider"> · </span>
                <strong>{h.device_class}</strong>
              </>
            ) : null}
          </div>
          <div className="guardian__marker-hover-row">
            <span>LAN:</span>
            <strong>{lanIp || "—"}</strong>
            <span className="guardian__marker-hover-divider"> · </span>
            <span>WAN:</span>
            <strong>{wanIp || "—"}</strong>
          </div>
          <div className="guardian__marker-hover-row">
            <span>CPU:</span>
            <strong>{h.cpu_pct != null ? `${Number(h.cpu_pct).toFixed(1)}%` : "—"}</strong>
            <span className="guardian__marker-hover-divider"> · </span>
            <span>Mem:</span>
            <strong>{h.mem_pct != null ? `${Number(h.mem_pct).toFixed(1)}%` : "—"}</strong>
          </div>
          <div className="guardian__marker-hover-row">
            <span>Geo:</span>
            <strong>{h.geo_source || "unknown"}</strong>
          </div>
        </div>
      </div>
    ),
  };
};

/** Fleet devices on a map — reuses the Guardian map view (minimal embed).
 * Only hosts that have reported geolocation (IP-geo posture or a manual
 * lat/lon override on system_hosts) render a pin. */
const FleetSystemsDevicesMap: React.FC<Props> = ({ hosts }) => {
  const vessels = useMemo(
    () => (hosts || []).map(hostVessel).filter(Boolean) as IVessel[],
    [hosts]
  );

  // Default the map to the viewing user's own location on load. Silent —
  // only resolves if permission was already granted; never opens a prompt.
  const { requestLocation, lngLat } = useLocationPermissions();
  const locationRequestedRef = useRef(false);
  useEffect(() => {
    if (locationRequestedRef.current) return;
    locationRequestedRef.current = true;
    void requestLocation({ skipPromptUI: true, skipBrowserPrompt: true });
  }, [requestLocation]);

  const mapCenter = useMemo<[number, number] | undefined>(() => {
    if (lngLat) return lngLat;
    if (!vessels.length) return undefined;
    const [sumLon, sumLat] = vessels.reduce(
      (acc, v) => [acc[0] + (v.lngLat?.[0] ?? 0), acc[1] + (v.lngLat?.[1] ?? 0)],
      [0, 0]
    );
    return [sumLon / vessels.length, sumLat / vessels.length];
  }, [lngLat, vessels]);

  if (!vessels.length && !mapCenter) {
    return (
      <div style={{ padding: "24px", textAlign: "center", opacity: 0.7 }}>
        No devices have reported a location yet. Locations appear once devices
        post network posture with IP geolocation, or when a manual latitude /
        longitude is set on the host.
      </div>
    );
  }
  const mapZoom = vessels.length > 1 ? 10 : 13;
  return (
    <GuardianView
      minimal
      mode="live"
      vessels={vessels}
      mapCenter={mapCenter}
      mapZoom={mapZoom}
      uploadIntervalSec={0}
      tracking={false}
      onStartTracking={noop}
      onStopTracking={noop}
      onRecenter={noop}
    />
  );
};

export default FleetSystemsDevicesMap;
