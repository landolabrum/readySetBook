import { getService } from "@webstack/common";
import IDataBaseService from "~/src/core/services/DataBaseService/IDataBaseService";
import { type CanonOverlay } from "@Canopy/models/canopyOverlayTypes";
import { OVERLAY_MODELS } from "@Canopy/models/overlayModels";

/* ------------------------------------------------------- */
/* Overlay display label helper                            */
/* ------------------------------------------------------- */

/**
 * Derives a human-readable label for an overlay.
 * Priority: title → filename from src/urls → model label → type
 */
export const overlayDisplayLabel = (ov: CanonOverlay): string => {
  // 1. Use label if present and non-empty
  if (typeof ov.label === 'string' && ov.label.trim()) {
    return ov.label.trim();
  }

  // 2. Use title if present and non-empty
  if (typeof ov.title === 'string' && ov.title.trim()) {
    return ov.title.trim();
  }

  // 3. For media/share-family types, extract filename from src or first url
  if (ov.type === 'media' || ov.type === 'camera' || ov.type === 'screen' || ov.type === 'encoder' || ov.type === 'pull') {
    const data = ov.data as any;
    const src = data?.src || (Array.isArray(data?.urls) && data.urls[0]);
    if (typeof src === 'string' && src.trim()) {
      try {
        // Extract filename from URL or path
        const url = new URL(src, 'http://placeholder');
        const pathname = url.pathname;
        const filename = pathname.split('/').pop();
        if (filename && filename.length > 0 && filename !== '/') {
          // Truncate long filenames
          return filename.length > 30 ? filename.slice(0, 27) + '...' : filename;
        }
      } catch {
        // Fallback: simple split
        const parts = src.split('/');
        const last = parts[parts.length - 1];
        if (last && last.length > 0) {
          return last.length > 30 ? last.slice(0, 27) + '...' : last;
        }
      }
    }
  }

  // 4. Use model label if available
  const modelLabel = OVERLAY_MODELS[ov.type as keyof typeof OVERLAY_MODELS]?.label;
  if (modelLabel) {
    return modelLabel;
  }

  // 5. Fallback to type name
  return ov.type || 'Unknown';
};

/** Shared types used by overlays */
export type Team = {
  id?: number | string;
  name?: string;
  competitor?: string;
  place?: number;
  score?: number;
  color?: string;
  gps?: string;
  speedMph?: number;
};

export type Overlay = CanonOverlay;

/* ------------------------------------------------------- */
/* API base helper                                         */
/* ------------------------------------------------------- */
export const getApiBaseFromDb = (): string => {
  const db: any = getService<IDataBaseService>("IDataBaseService");
  return String(
    db?.baseUrl || db?.getBaseUrl?.() || process.env.NEXT_PUBLIC_API_BASE || ""
  ).replace(/\/$/, "");
};

/* ------------------------------------------------------- */
/* Basic transforms / guards                               */
/* ------------------------------------------------------- */
export const clamp01 = (n: any) => Math.min(100, Math.max(0, Number(n) || 0));

export const toNumOrUndef = (val: unknown): number | undefined => {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

export const coerceTeams = (arr: any[] | undefined | null): Team[] =>
  Array.isArray(arr)
    ? arr.map((t, i) => ({
      id: toNumOrUndef(t?.id ?? t?.vehicle_number ?? t?.number ?? t?.team_id),
      name: t?.name ?? t?.team_name ?? undefined,
      competitor: (Array.isArray(t?.competitors) && t.competitors[0]?.name) || t?.competitor_name || t?.competitor || undefined,
      place:
        typeof t?.place === "number" ? t.place : toNumOrUndef(t?.place) ?? i + 1,
      score: toNumOrUndef(t?.score),
      color: typeof t?.color === "string" ? t.color : undefined,
    }))
    : [];

export const normType = (t?: string) => String(t ?? "").toLowerCase();
export const isClose = (a: number, b: number) =>
  Math.abs(Number(a) - Number(b)) < 1e-6;

export const anchorShift = (v?: number) =>
  v == null ? 0 : isClose(v, 50) ? -50 : isClose(v, 100) ? -100 : 0;

/**
 * Title coercion used by various overlay components.
 * Keep the return wide (any | undefined) to satisfy different prop unions
 * like OverlayScoreBoard.TitleInput.
 */
export const toTitleInput = (v: unknown): any | undefined =>
  v == null ? undefined : (v as any);

/* ------------------------------------------------------- */
/* Overlay normalization & filtering                       */
/* ------------------------------------------------------- */
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

// Memoization cache for filtered overlays to prevent unnecessary recomputation
const filteredCache = new Map<string, { result: Overlay[]; timestamp: number }>();
const FILTER_CACHE_TTL = 1000; // 1 second cache

function getOverlaySignature(arr: Overlay[]): string {
  return arr.map(o => `${o.id}-${o.enabled}-${o.z_index}-${o.type}`).join('|');
}

export const enabledOnlyLocal = (arr: Overlay[] | null | undefined) => {
  const overlays = Array.isArray(arr) ? arr : [];
  if (overlays.length === 0) return [];

  // Use cache for performance
  const signature = getOverlaySignature(overlays);
  const cached = filteredCache.get(signature);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < FILTER_CACHE_TTL) {
    return cached.result;
  }

  // Filter enabled overlays with proper boolean coercion
  const filtered = overlays.filter((o) => {
    // Use proper type-safe coercion to handle string 'true'/'false' and other edge cases
    const enabled = o?.enabled === true || String(o?.enabled).toLowerCase() === 'true';
    return enabled && !!normType(o?.type);
  });

  // Sort by z-index only when needed
  const result = filtered.length > 1
    ? filtered.sort((a, b) => Number(b?.z_index ?? 0) - Number(a?.z_index ?? 0))
    : filtered;

  // Cache result
  filteredCache.set(signature, { result, timestamp: now });

  // Clean old entries periodically
  if (filteredCache.size > 100) {
    const entries = Array.from(filteredCache.entries());
    entries.forEach(([key, value]) => {
      if ((now - value.timestamp) > FILTER_CACHE_TTL * 10) {
        filteredCache.delete(key);
      }
    });
  }

  return result;
};

export function rowsToCanon(rows: any[]): Overlay[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const data = r.data ?? r.payload ?? undefined;
      return {
        id: r.id ?? r.overlay_id ?? undefined,
        type: r.type,
        enabled: r.enabled !== false,
        x: r.x ?? 0,
        y: r.y ?? 0,
        z_index: r.z_index ?? 0,
        crop: (() => {
          if (Array.isArray(r.crop) && r.crop.length >= 4) {
            const c = (r.crop as any[]).slice(0, 4).map(Number) as [number, number, number, number];
            return c.some(v => v > 0) ? c : undefined;
          }
          // backward compat: legacy DB columns crop_width (left) / crop_height (top)
          const top = Number(r.crop_height) || 0;
          const left = Number(r.crop_width) || 0;
          return (top > 0 || left > 0) ? [top, 0, left, 0] as [number, number, number, number] : undefined;
        })(),
        variant: r.variant ?? null,
        animation: r.animation ?? null,
        label: r.label ?? null,
        title: r.title ?? "",
        description: r.description ?? "",

        data:
          typeof data === "string"
            ? (() => {
              try {
                return JSON.parse(data);
              } catch {
                return {};
              }
            })()
            : data ?? {},
      } as Overlay;
    })
    .filter((o) => !!normType(o.type));
}
