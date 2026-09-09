import { GuardianFix } from "./types";

const METERS_PER_SECOND_TO_MPH = 2.2369362920544;
const KMH_TO_MPH = 0.62137119223733;
const EARTH_RADIUS_M = 6371000;
const MAX_SPEED_LOOKBACK_MS = 2 * 60 * 1000;
const MIN_DISTANCE_FOR_SPEED_M = 1.5;

const toFiniteNumber = (value?: number | string | null) => {
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const normalizeDeviceIdentifier = (value?: string | null): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
};

export const normalizeDeviceLabel = (value?: string | null): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
};

const clampSpeed = (value?: number) => {
  if (value === undefined) return undefined;
  return Math.max(value, 0);
};

const explicitSpeedMph = (
  payload?: Partial<GuardianFix> & {
    speed?: number | null;
    speed_mph?: number | null;
    speed_mps?: number | null;
    speedUnit?: string | null;
    speed_unit?: string | null;
  }
): number | undefined => {
  const mph =
    toFiniteNumber(payload?.speedMph ?? payload?.speed_mph) ?? undefined;
  if (mph !== undefined) return clampSpeed(mph);

  const mps = toFiniteNumber(payload?.speed_mps) ?? undefined;
  if (mps !== undefined) return clampSpeed(mps * METERS_PER_SECOND_TO_MPH);

  const raw = toFiniteNumber(payload?.speed) ?? undefined;
  if (raw === undefined) return undefined;

  const unitRaw = (payload as any)?.speedUnit ?? (payload as any)?.speed_unit;
  const unit =
    typeof unitRaw === "string" ? unitRaw.trim().toLowerCase() : undefined;

  if (unit === "mph") return clampSpeed(raw);
  if (unit === "kmh" || unit === "km/h") {
    return clampSpeed(raw * KMH_TO_MPH);
  }

  // Browsers report m/s; assume meters-per-second when unit is unknown.
  return clampSpeed(raw * METERS_PER_SECOND_TO_MPH);
};

const derivedSpeedMph = (
  payload?: Partial<GuardianFix> & { timestamp?: number },
  previous?: GuardianFix
): number | undefined => {
  if (!payload?.timestamp || !previous?.timestamp) return undefined;
  const elapsedMs = payload.timestamp - previous.timestamp;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return undefined;
  if (elapsedMs > MAX_SPEED_LOOKBACK_MS) return undefined;

  const distance = metersBetween(previous, payload as GuardianFix);
  if (!Number.isFinite(distance)) return undefined;
  if (distance < MIN_DISTANCE_FOR_SPEED_M) return 0;

  const metersPerSecond = distance / (elapsedMs / 1000);
  return clampSpeed(metersPerSecond * METERS_PER_SECOND_TO_MPH);
};

export const metersBetween = (a: GuardianFix, b: GuardianFix): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    2 *
    Math.atan2(
      Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon),
      Math.sqrt(1 - (sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon))
    );
  return EARTH_RADIUS_M * c;
};

export const resolveSpeedMph = (
  payload?: Partial<GuardianFix> & {
    speed?: number | null;
    speed_mph?: number | null;
    speed_mps?: number | null;
  },
  previous?: GuardianFix
): number | undefined => {
  const explicit = explicitSpeedMph(payload);
  const derived = derivedSpeedMph(payload, previous);

  if (explicit !== undefined && derived !== undefined) {
    // Blend readings to smooth GPS jitter while keeping device-provided speed primary.
    return clampSpeed(explicit * 0.6 + derived * 0.4);
  }

  return explicit ?? derived;
};

export const dedupeTimeline = (points: GuardianFix[]): GuardianFix[] => {
  const byKey = new Map<string, GuardianFix>();
  [...points]
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach((p) => {
      const key = `${p.latitude.toFixed(5)}-${p.longitude.toFixed(5)}-${Math.round(
        p.timestamp
      )}-${p.deviceId || "primary"}`;
      byKey.set(key, p);
    });
  return Array.from(byKey.values()).sort((a, b) => a.timestamp - b.timestamp);
};

export const normalizeFix = (raw: any, fallbackUserId?: string): GuardianFix | null => {
  if (!raw) return null;
  const lat = Number(raw.latitude ?? raw.lat);
  const lon = Number(raw.longitude ?? raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const accuracy = toFiniteNumber(raw.accuracy);
  const rawTs = raw.recorded_at || raw.recordedAt || raw.timestamp || raw.created_at;
  const timestamp = rawTs ? new Date(rawTs).getTime() : Date.now();
  const deviceIdRaw = raw.deviceId ?? raw.device_id ?? raw.device?.id ?? raw.device_label;
  const deviceLabelRaw = raw.deviceLabel ?? raw.device_label ?? raw.device?.label;
  const deviceType =
    raw.deviceType ??
    raw.device_type ??
    raw.device_info?.deviceType ??
    raw.deviceInfo?.deviceType ??
    raw.device?.type;
  const deviceInfo = raw.device_info ?? raw.deviceInfo;
  const deviceId = normalizeDeviceIdentifier(deviceIdRaw) ?? undefined;
  const deviceLabel = normalizeDeviceLabel(deviceLabelRaw) || deviceIdRaw || deviceType || deviceId;

  const fix: GuardianFix = {
    latitude: lat,
    longitude: lon,
    accuracy,
    timestamp,
    displayTimestamp: Date.now(),
    deviceId,
    deviceLabel: normalizeDeviceLabel(deviceLabel) || deviceLabelRaw || deviceId || deviceType,
    deviceType,
    deviceInfo,
    userId: raw.userId ?? raw.user_id ?? fallbackUserId,
    recordedAt: timestamp,
    recorded_at: timestamp,
  };
  const speed = resolveSpeedMph({ ...raw, timestamp }, undefined);
  if (speed !== undefined) {
    fix.speedMph = speed;
  }
  return fix;
};
