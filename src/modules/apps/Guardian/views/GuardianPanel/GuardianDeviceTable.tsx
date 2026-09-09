import React, { useMemo } from "react";
import AdapTable from "@webstack/components/AdapTable/views/AdapTable";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import layoutStyles from "../../controller/Guardian.scss";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import { GuardianFix } from "../../hooks/useGuardian";
import { ONLINE_THRESHOLD_MS, parseTimestampValue } from "../../utils/vesselCommon";

type Props = {
  vessels?: IVessel[];
  deviceFixes?: GuardianFix[];
  onRemove?: (id: string) => void | Promise<void>;
  canRemoveDevices?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

const GuardianDeviceTable: React.FC<Props> = ({
  vessels = [],
  deviceFixes = [],
  onRemove,
  canRemoveDevices,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}) => {
  const { openModal, closeModal } = useModal();
  const fixVessels = useMemo(() => {
    const fromFixes: IVessel[] = deviceFixes
      .filter((fix) => fix && (fix.longitude != null && fix.latitude != null))
      .map((fix) => ({
        id: fix.deviceId || fix.deviceLabel || `dev-${fix.timestamp}`,
        name: fix.deviceLabel || fix.deviceId || "Device",
        lngLat: [fix.longitude as number, fix.latitude as number],
        meta: {
          displayName: fix.deviceLabel || fix.deviceId,
          deviceId: fix.deviceId,
          deviceLabel: fix.deviceLabel,
          deviceType: fix.deviceType || (fix.deviceInfo as any)?.deviceType,
          userId: fix.userId,
          lastSeen: fix.timestamp,
          latitude: fix.latitude,
          longitude: fix.longitude,
          speed: fix.speedMph,
        },
      }));
    const existingIds = new Set<string>();
    vessels.forEach((v) => {
      if (v?.id != null) existingIds.add(String(v.id));
      const metaId = (v as any)?.meta?.deviceId;
      if (metaId != null) existingIds.add(String(metaId));
    });
    return fromFixes.filter((v) => {
      const metaId = (v as any)?.meta?.deviceId;
      const id = v?.id;
      return !existingIds.has(String(metaId ?? "")) && !existingIds.has(String(id ?? ""));
    });
  }, [deviceFixes, vessels]);

  const displayRows = useMemo(() => {
    const source = [...vessels, ...fixVessels];
    return source.filter((v) => Boolean((v as any)?.meta || v?.lngLat));
  }, [fixVessels, vessels]);
  const toNumber = (value: any): number | undefined => {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : undefined;
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const resolveTimestamp = (value?: number | string | Date | null): number | undefined =>
    parseTimestampValue(value ?? undefined);
  const formatCoord = (value?: number) => (value == null ? "—" : value.toFixed(5));
  const formatLastSeenLabel = (value?: number | string | null) => {
    const timestamp = resolveTimestamp(value);
    if (!timestamp) return "—";
    const diffMs = Math.max(Date.now() - timestamp, 0);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diffMs < minute) return "just now";
    if (diffMs < hour) return `${Math.round(diffMs / minute)} min ago`;
    if (diffMs < day) return `${Math.round(diffMs / hour)} hr ago`;
    const days = Math.round(diffMs / day);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };
  const formatSpeedLabel = (value?: number | string | null) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return `${value.toFixed(1)} mph`;
    }
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    return "—";
  };
  const sortedRows = [...displayRows].sort((a, b) => {
    const getLastSeen = (meta?: any) =>
      meta?.lastSeen ?? meta?.recordedAt ?? meta?.timestamp ?? meta?.recorded_at ?? 0;
    const ma = getLastSeen((a as IVessel & { meta?: any }).meta);
    const mb = getLastSeen((b as IVessel & { meta?: any }).meta);
    return Number(mb || 0) - Number(ma || 0);
  });

  const now = Date.now();
  const rows = sortedRows.map((vessel, idx) => {
    const meta = (vessel as IVessel & { meta?: any }).meta ?? {};
    const lastSeenTs =
      typeof meta.lastSeen === "number"
        ? meta.lastSeen
        : resolveTimestamp(meta.lastSeen ?? meta.recordedAt ?? meta.timestamp ?? meta.recorded_at);
    const latestLatitude = toNumber(meta.latitude) ?? (vessel.lngLat ? toNumber(vessel.lngLat[1]) : undefined);
    const latestLongitude = toNumber(meta.longitude) ?? (vessel.lngLat ? toNumber(vessel.lngLat[0]) : undefined);
    const isOnline = typeof lastSeenTs === "number" && now - lastSeenTs <= ONLINE_THRESHOLD_MS;
    const statusLabel = isOnline ? "Online" : `Offline · ${formatLastSeenLabel(lastSeenTs)}`;
    return {
      __vesselIndex: idx,
      __vesselId: vessel.id,
      Name: meta.displayName || meta.userName || vessel.name || meta.userId || "Anonymous",
      Status: statusLabel,
      "Device type": meta.deviceType || meta.device_type || "-",
      Latitude: formatCoord(latestLatitude),
      Longitude: formatCoord(latestLongitude),
      "Last seen": formatLastSeenLabel(lastSeenTs),
      Speed: formatSpeedLabel(meta.speed ?? meta.speedMph),
    };
  });

  const showVesselModal = (vessel: IVessel) => {
    const meta = (vessel as IVessel & { meta?: any }).meta ?? {};
    const lastSeenTs =
      typeof meta.lastSeen === "number"
        ? meta.lastSeen
        : resolveTimestamp(meta.lastSeen ?? meta.recordedAt ?? meta.timestamp ?? meta.recorded_at);
    const removalId = meta.deviceId || vessel.id;
    openModal({
      title: "Device details",
      children: (
        <div className="guardian__device-modal">
          <p><strong>Name:</strong> {meta.displayName || meta.userName || vessel.name || meta.userId || "Unknown"}</p>
          <p><strong>User ID:</strong> {meta.userId || "—"}</p>
          <p><strong>Device ID:</strong> {meta.deviceId || "—"}</p>
          <p><strong>Device label:</strong> {meta.deviceLabel || vessel.id || "—"}</p>
          <p><strong>Device type:</strong> {meta.deviceType || "—"}</p>
          <p><strong>Last seen:</strong> {lastSeenTs ? new Date(lastSeenTs).toLocaleString() : "—"}</p>
          <p><strong>Latitude:</strong> {meta.latitude ?? (vessel.lngLat ? vessel.lngLat[1] : "—")}</p>
          <p><strong>Longitude:</strong> {meta.longitude ?? (vessel.lngLat ? vessel.lngLat[0] : "—")}</p>
          <p><strong>Speed:</strong> {meta.speed ?? meta.speedMph ?? "—"}</p>
        </div>
      ),
      confirm: {
        body: "Remove this device from the manifest and map?",
        statements: [
          { label: "Close", variant: "flat", onClick: () => closeModal() },
          ...(canRemoveDevices !== false && removalId
            ? [
              {
                label: "Remove device",
                variant: "danger" as const,
                onClick: () => {
                  if (onRemove) {
                    onRemove(String(removalId));
                  }
                  closeModal();
                },
              },
            ]
            : []),
        ],
      },
    });
  };

  return (
    <>
      <style jsx>{layoutStyles}</style>
      <section className="guardian__device-table">
        <div className="guardian__device-table-heading">
          <h3>Live vessel manifest</h3>
          <span>{displayRows.length ? `${displayRows.length} showing` : "No vessels"}</span>
        </div>
        <div className="guardian__device-table-scroll">
          <AdapTable
            data={rows}
            total={total ?? rows.length}
            page={page}
            setPage={onPageChange}
            limit={pageSize}
            setLimit={(next) => {
              const val = typeof next === "function" ? next(pageSize ?? 0) : next;
              if (onPageSizeChange) onPageSizeChange(Number(val));
            }}
            options={{
              placeholder: "No vessels are visible for this view.",
              hoverable: true,
              externalPagination: Boolean(total),
            }}
            onRowClick={(row: any) => {
              const idx = typeof row?.__vesselIndex === "number" ? row.__vesselIndex : undefined;
              const byIndex = typeof idx === "number" ? sortedRows[idx] : undefined;
              const byId = row?.__vesselId
                ? sortedRows.find((v) => v.id === row.__vesselId) || displayRows.find((v) => v.id === row.__vesselId)
                : undefined;
              const target = byIndex || byId;
              if (target) showVesselModal(target as IVessel);
            }}
            variant="mini"
          />
        </div>
        {!rows.length && <div className="guardian__hint">No live devices yet. Start tracking to populate.</div>}
      </section>
    </>
  );
};

export default GuardianDeviceTable;
