
/* =========================================================================================
   3) Local overlay store helpers — tolerant of wrapped values {value, expiry}
   ========================================================================================= */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import useLocalStorage from '@webstack/hooks/storage/useLocalStorage';
import { CanonOverlay, OverlayType, jsonEq, normalizeOverlayArray } from '@Canopy/models/canopyOverlayTypes';

const SCHEMA = 'v2';

export const LS_OVERLAY_PREFIX = `event_overlay:${SCHEMA}:`;
export const LS_META_PREFIX = `event_overlay_meta:${SCHEMA}:`;

export const overlaysKeyFor = (eventId?: string) =>
  (eventId ? `${LS_OVERLAY_PREFIX}${eventId}` : undefined);
export const metaKeyFor = (eventId?: string) =>
  (eventId ? `${LS_META_PREFIX}${eventId}` : undefined);

export type OverlayMeta = {
  t?: string; // overlay id
  editor?: { enabled?: Partial<Record<OverlayType, boolean>> };
};

export const notifyOverlaysChanged = (key?: string) => {
  if (!key) return;
  try {
    const e = new StorageEvent('storage', { key, newValue: String(Date.now()) });
    window.dispatchEvent(e);
  } catch {
    /* no-op */
  }
};

export const toggleOverlayEnabled = (list: CanonOverlay[], type: OverlayType, force?: boolean) =>
  list.map((o) =>
    o.type === type ? { ...o, enabled: typeof force === 'boolean' ? force : !o.enabled } : o
  );

export function useOverlayStore(eventId?: string, titleSeed?: string) {
  const ovKey = overlaysKeyFor(eventId);
  const mtKey = metaKeyFor(eventId);

  const { localItem: rawOverlays, setLocalItem: _setLsOverlays } = useLocalStorage(ovKey);
  const { localItem: rawMeta, setLocalItem: _setLsMeta, getLocalItem: _getLsMeta } = useLocalStorage(mtKey);

  // Memoize the normalized overlays by stable signature to avoid churn during HMR/SSE
  const prevSigRef = useRef<string>("__init__");
  const prevNormRef = useRef<CanonOverlay[]>([]);
  const overlays: CanonOverlay[] = useMemo(() => {
    const raw = Array.isArray(rawOverlays) ? rawOverlays : (rawOverlays as any)?.value ?? [];
    const sig = (() => { try { return JSON.stringify(raw); } catch { return String(raw?.length ?? 0); } })();
    if (sig === prevSigRef.current) {
      return prevNormRef.current;
    }

    const normalized = normalizeOverlayArray(raw, titleSeed);

    prevSigRef.current = sig;
    prevNormRef.current = normalized;
    return normalized;
  }, [rawOverlays, titleSeed]);

  const meta: OverlayMeta =
    rawMeta && typeof rawMeta === 'object' && 'value' in (rawMeta as any)
      ? (rawMeta as any).value
      : ((rawMeta as any) || {});

  // Write-through ref: tracks the latest overlays written by setOverlays,
  // updated synchronously so sequential functional updaters within the same
  // React render cycle see each other's accumulated changes.
  const pendingRef = useRef<CanonOverlay[] | null>(null);
  useEffect(() => { pendingRef.current = null; }, [rawOverlays]);

  // Keep a ref to the latest closure values so setOverlays can be a stable callback
  const stateRef = useRef({ overlays, meta, ovKey, mtKey, titleSeed, _setLsOverlays, _setLsMeta, _getLsMeta });
  stateRef.current = { overlays, meta, ovKey, mtKey, titleSeed, _setLsOverlays, _setLsMeta, _getLsMeta };

  const setOverlays = useCallback((next: CanonOverlay[] | ((prev: CanonOverlay[]) => CanonOverlay[])) => {
    const { overlays, meta, ovKey, mtKey, titleSeed, _setLsOverlays, _setLsMeta, _getLsMeta } = stateRef.current;
    if (!ovKey) return;
    const prev = pendingRef.current ?? overlays;
    const payload = typeof next === 'function' ? (next as any)(prev) : next;

    // Dedupe by id (keep last occurrence) to avoid duplicate keys in React lists
    const deduped = Array.isArray(payload)
      ? (() => {
        const seen = new Set<string>();
        const out: any[] = [];
        for (let i = payload.length - 1; i >= 0; i -= 1) {
          const o: any = payload[i];
          const id = typeof o?.id === 'string' ? o.id : undefined;
          if (id && seen.has(id)) continue;
          if (id) seen.add(id);
          out.push(o);
        }
        return out.reverse();
      })()
      : payload;

    const canon: CanonOverlay[] = normalizeOverlayArray(deduped, titleSeed);

    // Idempotency guard: avoid writing if unchanged
    const isEqual = jsonEq(prev, canon);
    if (isEqual) {
      // console.warn('[useOverlayStore] setOverlays: No change detected, skipping update');
      return;
    }

    // console.log('[useOverlayStore] setOverlays: Writing update to localStorage');
    pendingRef.current = canon;
    _setLsOverlays(ovKey as string, canon);
    notifyOverlaysChanged(ovKey);

    // Always respect the latest meta from storage (user may have just set t via Edit Overlay)
    const latestMeta = (() => {
      try {
        const raw = mtKey ? _getLsMeta?.(mtKey) : undefined;
        if (!raw) return meta as any;
        return (raw as any)?.value ?? raw ?? meta;
      } catch {
        return meta as any;
      }
    })();

    const enabledMap: Partial<Record<OverlayType, boolean>> = {};
    for (const { type, enabled } of canon) {
      enabledMap[type] = enabledMap[type] || !!enabled;
    }
    const firstEnabled = canon.find((c) => c.enabled)?.id;
    const prevMeta = (latestMeta as any) ?? {};
    const targetTab = typeof prevMeta.t === 'string' && prevMeta.t.trim() ? prevMeta.t : firstEnabled;
    // Preserve existing meta flags like seedHash/edited; only update enabled map and active tab
    const desired = {
      ...(prevMeta || {}),
      editor: { ...(meta as any)?.editor, enabled: enabledMap },
      t: targetTab,
    } as any;

    if (mtKey && !jsonEq(meta, desired)) {
      _setLsMeta(mtKey as string, desired);
    }
  }, []);

  return { overlays, setOverlays, meta, setMeta: _setLsMeta };
}
