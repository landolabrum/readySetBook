import React, { useCallback, useMemo } from "react";
import AdapTable, { TableOptions } from "@webstack/components/AdapTable/views/AdapTable";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import layoutStyles from "../../controller/Guardian.scss";
import panelStyles from "./GuardianPanel.scss";
import { formatRelativeTime, resolveLastSeen } from "../../utils/vesselCommon";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";

type Props = {
  vessels?: IVessel[];
  clearanceLevel?: number;
  canRemoveDevices?: boolean;
  onRemoveVessel?: (id: string) => void | Promise<void>;
  onPurgeAllTracking?: () => void | Promise<void>;
};

const GuardianTrackingGrid: React.FC<Props> = ({
  vessels = [],
  clearanceLevel = 0,
  canRemoveDevices,
  onRemoveVessel,
  onPurgeAllTracking,
}) => {
  const { openModal, closeModal } = useModal();
  const allowRemoval = canRemoveDevices ?? clearanceLevel >= 12;
  const allowPurgeAll = clearanceLevel >= 15;

  const enriched = useMemo(() => {
    return [...vessels].map((v) => {
      const meta = (v as IVessel & { meta?: any }).meta ?? {};
      const lastSeen = resolveLastSeen(meta);
      const lat = Array.isArray(v.lngLat) ? Number(v.lngLat[1]) : undefined;
      const lon = Array.isArray(v.lngLat) ? Number(v.lngLat[0]) : undefined;
      const speed = meta.speedMph ?? meta.speed;
      const speedLabel =
        typeof speed === "number" && Number.isFinite(speed) ? `${Number(speed).toFixed(1)} mph` : "—";
      const deviceLabel = meta.deviceLabel || meta.deviceId || v.name || meta.userId || "Device";
      return {
        vessel: v,
        meta,
        lastSeen,
        lat,
        lon,
        speedLabel,
        deviceLabel,
      };
    }).sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
  }, [vessels]);

  const rows = useMemo(
    () =>
      enriched.map((entry, idx) => ({
        __index: idx,
        __vesselId: entry.vessel.id,
        User: entry.meta.displayName || entry.meta.userName || entry.meta.userId || "—",
        Device: entry.deviceLabel,
        Type: entry.meta.deviceType || "—",
        Status: "Tracking",
        "Last seen": formatRelativeTime(entry.lastSeen),
        "Updated at": entry.lastSeen ? new Date(entry.lastSeen).toLocaleString() : "—",
        Latitude: Number.isFinite(entry.lat) ? (entry.lat as number).toFixed(4) : "—",
        Longitude: Number.isFinite(entry.lon) ? (entry.lon as number).toFixed(4) : "—",
        Speed: entry.speedLabel,
      })),
    [enriched]
  );

  const showDetailsModal = useCallback(
    (entry: (typeof enriched)[number]) => {
      if (!entry) return;
      const removalId = entry.meta.deviceId || entry.meta.deviceLabel || entry.vessel.id;
      const latDisplay = Number.isFinite(entry.lat)
        ? (entry.lat as number).toFixed(5)
        : entry.vessel.lngLat && Number.isFinite(entry.vessel.lngLat?.[1])
          ? Number(entry.vessel.lngLat?.[1]).toFixed(5)
          : "—";
      const lonDisplay = Number.isFinite(entry.lon)
        ? (entry.lon as number).toFixed(5)
        : entry.vessel.lngLat && Number.isFinite(entry.vessel.lngLat?.[0])
          ? Number(entry.vessel.lngLat?.[0]).toFixed(5)
          : "—";
      openModal({
        title: entry.deviceLabel,
        children: (
          <div className="guardian__device-modal">
            <p><strong>User:</strong> {entry.meta.displayName || entry.meta.userName || entry.meta.userId || "—"}</p>
            <p><strong>Device ID:</strong> {entry.meta.deviceId || entry.vessel.id || "—"}</p>
            <p><strong>Device label:</strong> {entry.meta.deviceLabel || entry.deviceLabel || "—"}</p>
            <p><strong>Type:</strong> {entry.meta.deviceType || "—"}</p>
            <p><strong>Latitude:</strong> {latDisplay}</p>
            <p><strong>Longitude:</strong> {lonDisplay}</p>
            <p><strong>Speed:</strong> {entry.speedLabel}</p>
            <p><strong>Last fix:</strong> {entry.lastSeen ? new Date(entry.lastSeen).toLocaleString() : "—"}</p>
          </div>
        ),
        confirm: {
          body:
            allowRemoval && removalId
              ? "Remove this device from the live tracking manifest and purge its historical fixes?"
              : undefined,
          statements: [
            { label: "Close", variant: "flat", onClick: () => closeModal() },
            ...(allowRemoval && removalId
              ? [
                {
                  label: "Remove device",
                  variant: "danger" as const,
                  onClick: () => {
                    const work = onRemoveVessel?.(String(removalId));
                    if (work && typeof (work as Promise<void>).finally === "function") {
                      (work as Promise<void>).finally(() => closeModal());
                    } else {
                      closeModal();
                    }
                  },
                },
              ]
              : []),
          ],
        },
      });
    },
    [allowRemoval, closeModal, onRemoveVessel, openModal]
  );

  const handleRowClick = useCallback(
    (row: any) => {
      const idx = typeof row?.__index === "number" ? row.__index : -1;
      if (idx < 0 || idx >= enriched.length) return;
      showDetailsModal(enriched[idx]);
    },
    [enriched, showDetailsModal]
  );

  const options = useMemo<TableOptions>(
    () => ({
      tableTitle: "Live tracking (admin)",
      hoverable: true,
      hideColumns: ["__index", "__vesselId"],
      placeholder: "No devices are actively tracking.",
    }),
    []
  );

  if (clearanceLevel < 12) return null;

  return (
    <>
      <style jsx>{layoutStyles}</style>
      <style jsx>{panelStyles}</style>
      <section className="guardian__section guardian__section--admin-grid">
        <div className="guardian__device-table-heading">
          <h3>Tracking now</h3>
          <div className="guardian__device-table-actions">
            <span>{vessels.length ? `${vessels.length} active` : "No active devices"}</span>
            {allowPurgeAll && onPurgeAllTracking ? (
              <UiButton
                variant="danger"
                onClick={() => {
                  openModal({
                    title: "Purge GPS tracking",
                    children: (
                      <div className="guardian__device-modal">
                        <p>
                          This will delete <strong>all</strong> GPS tracking data for <strong>all users</strong>.
                        </p>
                        <p>This affects live tracking and timeline history.</p>
                      </div>
                    ),
                    confirm: {
                      body: "Confirm purge of all GPS tracking tables?",
                      statements: [
                        { label: "Cancel", variant: "flat", onClick: () => closeModal() },
                        {
                          label: "Purge tracking",
                          variant: "danger" as const,
                          onClick: () => {
                            const work = onPurgeAllTracking?.();
                            if (work && typeof (work as Promise<void>).finally === "function") {
                              (work as Promise<void>).finally(() => closeModal());
                            } else {
                              closeModal();
                            }
                          },
                        },
                      ],
                    },
                  });
                }}
              >
                Purge tracking
              </UiButton>
            ) : null}
          </div>
        </div>
        {vessels.length ? (
          <AdapTable data={rows} options={options} variant="mini" onRowClick={handleRowClick} />
        ) : (
          <div className="guardian__hint">No devices are actively tracking right now.</div>
        )}
      </section>
    </>
  );
};

export default GuardianTrackingGrid;
