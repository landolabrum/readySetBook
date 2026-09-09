import { IVessel } from "../models/IMapVessel";

export interface IVesselGroup {
  /** Stable key for the coordinate bucket (also the mapbox marker key). */
  key: string;
  /** Representative coordinate all members share. */
  lngLat: [number, number];
  /** Members at this coordinate, order-stabilized so fan positions don't jump. */
  vessels: IVessel[];
}

/**
 * Bucket vessels that share the same GPS coordinate so co-located markers can
 * be drawn as a single cluster instead of stacking invisibly on one pixel.
 *
 * IP-geolocated fleet devices behind a common WAN report identical lat/lon, so
 * an exact-coordinate key (rounded to `precision` decimals, ~1m at 5dp) is all
 * that's needed — no per-zoom reprojection. Vessels without a coordinate are
 * skipped (the marker layer ignores them too).
 */
export const groupVesselsByCoord = (
  vessels: IVessel[],
  precision = 5
): IVesselGroup[] => {
  const buckets = new Map<string, IVesselGroup>();
  for (const vessel of vessels) {
    const lngLat = vessel?.lngLat;
    if (!Array.isArray(lngLat) || lngLat.length !== 2) continue;
    const lon = Number(lngLat[0]);
    const lat = Number(lngLat[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const key = `${lon.toFixed(precision)},${lat.toFixed(precision)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.vessels.push(vessel);
    } else {
      buckets.set(key, { key, lngLat: [lon, lat], vessels: [vessel] });
    }
  }
  // Stabilize member order by vessel id so a member keeps the same fan slot
  // across re-renders.
  for (const group of buckets.values()) {
    group.vessels.sort((a, b) =>
      String(a?.id ?? "").localeCompare(String(b?.id ?? ""))
    );
  }
  return Array.from(buckets.values());
};
