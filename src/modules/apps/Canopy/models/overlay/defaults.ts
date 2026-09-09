import type { CanonOverlay, OverlayIdContext, OverlayType } from './types';
import { DISABLED_OVERLAY_TYPES, OVERLAY_MODELS } from '../overlayModels';
import { toNum, clamp, coerceEnabled } from './coerce';
import { aliasType, idForType } from './internals';

export const defaultOverlayFor = (
  t: OverlayType,
  titleSeed?: string,
  enabled?: boolean,
  idCtx?: OverlayIdContext,
): CanonOverlay => {
  if (DISABLED_OVERLAY_TYPES.has(t)) throw new Error(`Overlay type "${t}" is disabled`);
  const cfg = OVERLAY_MODELS[t];
  return {
    id: idForType(t, idCtx),
    type: t,
    enabled: enabled ?? false,
    variant: 'default',
    animation: 'none',
    label: null,
    title: t === 'scoreboard' ? titleSeed ?? 'Scoreboard' : null,
    description: null,
    x: cfg.defaultPos.x,
    y: cfg.defaultPos.y,
    z_index: 1,
    data: cfg.defaultPayload(),
  };
};

const normalizeOverlay = (raw: any, titleSeed?: string, idCtx?: OverlayIdContext): CanonOverlay | null => {
  const t = aliasType(raw?.type);
  if (!t) return null;
  const cfg = OVERLAY_MODELS[t];
  const rawVariant = raw?.variant ?? 'default';
  return {
    id:
      typeof raw?.id === 'string' && raw.id.trim()
        ? raw.id
        : raw?.id != null
          ? String(raw.id)
          : idForType(t, idCtx),
    type: t,
    enabled: coerceEnabled(raw?.enabled),
    x: clamp(toNum(raw?.x, cfg.defaultPos.x), 0, 100),
    y: clamp(toNum(raw?.y, cfg.defaultPos.y), 0, 100),
    width:       raw?.width      != null ? Math.max(0, toNum(raw.width, 0))         : undefined,
    height:      raw?.height     != null ? Math.max(0, toNum(raw.height, 0))        : undefined,
    crop: (() => {
      if (Array.isArray(raw?.crop) && raw.crop.length >= 4) {
        const c = (raw.crop as any[]).slice(0, 4).map((v: any) => clamp(toNum(v, 0), 0, 100)) as [number, number, number, number];
        return c.some(v => v > 0) ? c : undefined;
      }
      // backward compat: legacy crop_width (left) / crop_height (top)
      const top = clamp(toNum(raw?.crop_height, 0), 0, 100);
      const left = clamp(toNum(raw?.crop_width, 0), 0, 100);
      return (top > 0 || left > 0) ? [top, 0, left, 0] as [number, number, number, number] : undefined;
    })(),
    z_index: toNum(raw?.z_index, 1),
    variant: rawVariant === 'carousel' ? 'default' : rawVariant,
    animation: raw?.animation ?? 'none',
    label: raw?.label ?? null,
    title: raw?.title ?? (t === 'scoreboard' ? titleSeed ?? 'Scoreboard' : null),
    description: raw?.description ?? null,
    data: cfg.mergeData(cfg.defaultPayload(), raw?.data),
  };
};

export const mergeOverlay = (a: CanonOverlay, b: CanonOverlay): CanonOverlay => {
  const cfg = OVERLAY_MODELS[a.type];
  return { ...a, ...b, enabled: coerceEnabled(b?.enabled ?? a?.enabled), data: cfg.mergeData(a.data, b.data) };
};

export const normalizeOverlayArray = (arr: any[], titleSeed?: string, idCtx?: OverlayIdContext): CanonOverlay[] => {
  const list: CanonOverlay[] = [];
  for (const raw of Array.isArray(arr) ? arr : []) {
    const c = normalizeOverlay(raw, titleSeed, idCtx);
    if (!c) continue;
    if (!c.id) c.id = idForType(c.type, idCtx);
    list.push(c);
  }
  return list.slice().sort((a, b) => toNum(b.z_index) - toNum(a.z_index));
};

export const enabledOnly = (arr: CanonOverlay[] | null | undefined): CanonOverlay[] => {
  if (!arr) return [];
  return arr
    .filter((o) => coerceEnabled(o?.enabled))
    .slice()
    .sort((a, b) => toNum(b.z_index) - toNum(a.z_index));
};

export const realOverlaysOnly = (arr: CanonOverlay[] | null | undefined): CanonOverlay[] =>
  arr ? (arr.filter(Boolean) as CanonOverlay[]) : [];

export const enabledRealOverlaysOnly = (arr: CanonOverlay[] | null | undefined): CanonOverlay[] =>
  realOverlaysOnly(arr).filter((o) => coerceEnabled(o?.enabled));
