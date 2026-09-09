export const iconForDeviceType = (deviceType?: string) =>
  deviceType === "mobile" ? "fa-circle-phone-flip" : "fa-computer-classic";

export const parseTimestampValue = (value?: number | string | Date): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value instanceof Date) return value.getTime();
  return undefined;
};

export const formatRelativeTime = (timestamp?: number | null): string => {
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

export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
export const TRACKING_RECENT_WINDOW_MS = 3 * 60 * 1000;

export const resolveLastSeen = (meta?: Record<string, any>): number | undefined => {
  if (!meta) return undefined;
  return parseTimestampValue(
    meta.lastSeen ?? meta.recordedAt ?? meta.timestamp ?? meta.recorded_at ?? meta.last_seen
  );
};

export const isVesselOnline = (vessel: { meta?: Record<string, any> }, now: number = Date.now()): boolean => {
  const lastSeen = resolveLastSeen(vessel?.meta);
  return typeof lastSeen === "number" ? now - lastSeen <= ONLINE_THRESHOLD_MS : false;
};

export const isVesselActivelyTracking = (
  vessel: { meta?: Record<string, any> },
  now: number = Date.now()
): boolean => {
  const meta = vessel?.meta || {};
  const explicitTracking = Boolean(
    meta.isTracking ||
    meta.tracking ||
    meta.is_tracking ||
    meta.trackingEnabled ||
    meta.status === "tracking" ||
    meta.trackingStatus === "tracking"
  );

  if (!explicitTracking) return false;

  const lastSeen = resolveLastSeen(meta);
  if (typeof lastSeen !== "number") return true;

  return now - lastSeen <= TRACKING_RECENT_WINDOW_MS;
};
