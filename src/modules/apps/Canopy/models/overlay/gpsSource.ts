export type AddressShape = {
  lat?: number | null;
  lng?: number | null;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export type GpsSource =
  | { kind: 'manual'; lat: number; lng: number; address?: AddressShape | null }
  | { kind: 'team'; team_number: string }
  | { kind: 'guardian'; user_id: string; device_id?: string | null };
  // TODO: | { kind: 'event' } — event center, auto-position from course components

export type GpsSourceKind = GpsSource['kind'];

export type LatLng = { lat: number; lng: number };

export type GpsState =
  | { kind: 'none' }
  | { kind: 'live' }
  | { kind: 'pending'; sourceKind: GpsSourceKind; label: string }
  | { kind: 'stale';   sourceKind: GpsSourceKind; label: string; ageSec: number }
  | { kind: 'error';   sourceKind: GpsSourceKind; label: string };

export const migrateLegacyToGpsSource = (data: any): GpsSource | null => {
  // Priority: team_number > userId > (lat,lng) > null
  const teamNum = data?.team_number != null ? String(data.team_number).trim() : '';
  if (teamNum) {
    return { kind: 'team', team_number: teamNum };
  }

  const rawUserId = data?.userId ?? data?.user_id;
  const userIdStr = rawUserId != null ? String(rawUserId).trim() : '';
  if (userIdStr) {
    return { kind: 'guardian', user_id: userIdStr };
  }

  const lat = Number(data?.lat);
  const lng = Number(data?.lng ?? data?.lon);
  if (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  ) {
    return { kind: 'manual', lat, lng, address: data?.address ?? null };
  }

  return null;
};

const EARTH_RADIUS_MI = 3958.8;
const DEG_TO_RAD = Math.PI / 180;

export const haversineMiles = (a: LatLng, b: LatLng): number => {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const bearing = (from: LatLng, to: LatLng): number => {
  const dLng = (to.lng - from.lng) * DEG_TO_RAD;
  const lat1 = from.lat * DEG_TO_RAD;
  const lat2 = to.lat * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
};

export const cellKey = (lat: number, lng: number, sizeDeg: number, prefix = 'cell'): string => {
  const row = Math.floor(lat / sizeDeg);
  const col = Math.floor(lng / sizeDeg);
  return `${prefix}:${row}:${col}`;
};
