import { coerceEnabled } from "@Canopy/models/canopyOverlayTypes";
import { type Overlay, type Team } from "./types";

export const DESIGN_W = 720;
export const DESIGN_H = 1080;

const DISABLED_TYPES = new Set<string>();
export const normType = (t?: string) => {
  const v = String(t ?? "").toLowerCase();
  if (DISABLED_TYPES.has(v)) return "";
  return v;
};
export const clamp01 = (n: any) => Math.min(100, Math.max(0, Number(n) || 0));
export const isClose = (a: number, b: number) => Math.abs(Number(a) - Number(b)) < 1e-6;
export const anchorShift = (v?: number) => (v == null ? 0 : isClose(v, 50) ? -50 : isClose(v, 100) ? -100 : 0);

export const toNumOrUndef = (val: unknown): number | undefined => {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

export const parseOverlays = (raw: any): Overlay[] => {
  if (Array.isArray(raw)) return raw as Overlay[];
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? (j as Overlay[]) : [];
    } catch { }
  }
  return [];
};

// Shared memoization for overlay filtering
const overlayFilterCache = new Map<string, { result: Overlay[]; timestamp: number }>();
const CACHE_TTL = 1000;

const stableJson = (val: unknown): string => {
  try {
    return JSON.stringify(val, (_k, v) => (typeof v === "bigint" ? String(v) : v));
  } catch {
    return "";
  }
};

function overlaySignature(arr: Overlay[]): string {
  // Include payload-ish fields so scoreboard data changes bust the cache
  return arr
    .map((o) =>
      [
        o.id,
        o.enabled,
        o.z_index,
        o.type,
        stableJson(o.data),
        o.title,
        o.description,
        o.variant,
      ].join("::")
    )
    .join("|");
}

export const enabledOnlyLocal = (arr: Overlay[] | null | undefined) => {
  const overlays = Array.isArray(arr) ? arr : [];
  if (overlays.length === 0) return [];

  const sig = overlaySignature(overlays);
  const cached = overlayFilterCache.get(sig);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }

  const result: Overlay[] = overlays
    .filter((o) => {
      const enabled = coerceEnabled(o?.enabled);
      return enabled && !!normType(o?.type);
    })
    .sort((a, b) => Number(b?.z_index ?? 0) - Number(a?.z_index ?? 0));

  overlayFilterCache.set(sig, { result, timestamp: now });

  // Periodic cleanup
  if (overlayFilterCache.size > 50) {
    Array.from(overlayFilterCache.entries()).forEach(([key, value]) => {
      if ((now - value.timestamp) > CACHE_TTL * 5) overlayFilterCache.delete(key);
    });
  }

  return result;
};

export const coerceTeams = (arr: any[] | undefined | null): Team[] =>
  Array.isArray(arr)
    ? arr.map((t, i) => {
      const idStr =
        t?.id != null
          ? String(t.id)
          : t?.team_id != null
            ? String(t.team_id)
            : t?.event_team_id != null
              ? String(t.event_team_id)
              : t?.number != null
                ? String(t.number)
                : undefined;
      // Be liberal in accepting both `vehicle_number` and legacy `number`
      const vehicle =
        t?.vehicle_number != null
          ? String(t.vehicle_number)
          : t?.number != null
            ? String(t.number)
            : undefined;
      const out: Team = {
        id: idStr ?? vehicle,
        name: t?.name ?? t?.team_name ?? undefined,
        competitor: (Array.isArray(t?.competitors) && t.competitors[0]?.name) || t?.competitor_name || t?.competitor || undefined,
        competitors: Array.isArray(t?.competitors)
          ? (t.competitors as any[]).map((c) => ({
            id: c?.id,
            name: c?.name ?? null,
            role: c?.role ?? null,
            position: typeof c?.position === 'number' ? c.position : (c?.position != null ? Number(c.position) : null),
          }))
          : undefined,
        place: typeof t?.place === "number" ? t.place : toNumOrUndef(t?.place) ?? toNumOrUndef(t?.score) ?? i + 1,
        score: toNumOrUndef(t?.score),
        color: typeof t?.color === "string" ? t.color : undefined,
        // Always provide a vehicle_number for rendering; fallback through known fields
        vehicle_number: vehicle ?? (idStr != null ? String(idStr) : undefined),
      } as Team;
      return out;
    })
    : [];
