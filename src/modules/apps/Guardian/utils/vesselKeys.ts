import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";

type VesselMeta = {
  userId?: string;
  deviceId?: string;
  deviceLabel?: string;
};

const normalizeUser = (value?: string | null) => `${value ?? ""}`.trim();
const normalizeDevice = (value?: string | null) => `${value ?? ""}`.trim().toLowerCase();

export const buildVesselKey = (meta?: VesselMeta, fallback?: string): string => {
  const userId = normalizeUser(meta?.userId);
  const deviceId = normalizeDevice(meta?.deviceId || meta?.deviceLabel);
  if (userId && deviceId) return `${userId}:${deviceId}`;
  if (deviceId) return `device:${deviceId}`;
  if (userId) return `user:${userId}`;
  if (fallback?.trim()) return fallback.trim();
  return "vessel:unknown";
};

const normalizeVessel = (vessel: IVessel): IVessel => {
  const meta = (vessel as IVessel & { meta?: VesselMeta }).meta;
  const fallback = `${vessel.id ?? vessel.name ?? `coords:${vessel.lngLat?.join(",")}`}`;
  const key = buildVesselKey(meta, fallback);
  if (vessel.id === key) return vessel;
  return { ...vessel, id: key };
};

export const dedupeVessels = (items: IVessel[]): IVessel[] => {
  const seen = new Map<string, IVessel>();
  items.forEach((item) => {
    const normalized = normalizeVessel(item);
    if (!normalized.id) return;
    seen.set(String(normalized.id), normalized);
  });
  return Array.from(seen.values());
};
