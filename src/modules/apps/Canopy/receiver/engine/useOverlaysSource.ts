import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOverlayStore } from "@Canopy/hooks/useOverlayStore";
import { getService } from "@webstack/common";
import IDataBaseService from "~/src/core/services/DataBaseService/IDataBaseService";
import { getOverlayStream } from "@Canopy/context/CanopyProvider";
import { normalizeOverlayArray, jsonStable, coerceEnabled } from "@Canopy/models/canopyOverlayTypes";
import { enabledOnlyLocal, normType, parseOverlays } from "./utils";
import type { Overlay, SourceMode } from "./types";

function getApiBaseFromDb() {
  const db: any = getService<IDataBaseService>("IDataBaseService");
  return String(db?.baseUrl || db?.getBaseUrl?.() || process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
}

function overlayStreamPath(eventId: string) {
  const base = getApiBaseFromDb();
  const eid = encodeURIComponent(eventId);
  // Prefer the same API base used by DataBaseService so we hit the
  // backend service directly instead of the frontend origin.
  const fallback = String(process.env.NEXT_PUBLIC_PRODUCTION_SERVER?.trim() || '');
  const origin = base || fallback;
  return `${origin}/db/overlay_stream?event_id=${eid}`;
}

const mergeSnapshots = (prev: Overlay[], next: Overlay[]): Overlay[] => {
  // Use overlay `id` when available. For items without an `id`, fall back to
  // a stable fingerprint based on the overlay content to avoid accidental
  // inheritance of state when array positions shift (which previously used
  // an index-based key and could copy `enabled` from the wrong item).
  const keyFn = (o: Overlay) => {
    if (o?.id != null) return String(o.id);
    return `${normType(o?.type)}:${jsonStable(o)}`;
  };

  // Explicitly respect empty snapshots so disables/clears propagate immediately
  if (!next || next.length === 0) return [];

  const mapPrev = new Map<string, Overlay>();
  prev?.forEach((p) => mapPrev.set(keyFn(p), p));

  const merged: Overlay[] = next.map((n) => {
    const k = keyFn(n);
    const prevMatch = mapPrev.get(k);
    const nextEnabledRaw = (n as any)?.enabled;
    const enabled = nextEnabledRaw !== undefined ? coerceEnabled(nextEnabledRaw) : coerceEnabled(prevMatch?.enabled ?? false);
    return { ...(prevMatch || {}), ...n, enabled } as Overlay;
  });

  return merged.sort((x, y) => Number((y as any)?.z_index ?? 0) - Number((x as any)?.z_index ?? 0));
};

const rowsToCanon = (rows: any[]): Overlay[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const data = r.data ?? r.payload ?? undefined;
      return {
        id: r.id ?? r.overlay_id ?? undefined,
        type: r.type,
        enabled: coerceEnabled(r.enabled),
        x: r.x ?? 0,
        y: r.y ?? 0,
        z_index: r.z_index ?? 0,
        variant: r.variant ?? null,
        animation: r.animation ?? null,
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
};

type UseOverlaysSourceArgs = {
  overlays?: Overlay[] | null | undefined;
  eventId?: string | number;
  source?: SourceMode;
  pollMs?: number;
  useSSE?: boolean;
};

export function useOverlaysSource({ overlays, eventId, source, pollMs, useSSE = true }: UseOverlaysSourceArgs) {
  const effectiveSource: SourceMode = useMemo<SourceMode>(() => {
    if (overlays !== undefined) return "prop";
    if (eventId != null) return source ?? "local";
    return "prop";
  }, [overlays, eventId, source]);

  const { overlays: localOverlays } = useOverlayStore(eventId != null ? String(eventId) : undefined, undefined);
  const db = useMemo(() => (effectiveSource === "server" ? getService<IDataBaseService>("IDataBaseService") : null), [effectiveSource]);

  const [serverOverlays, setServerOverlays] = useState<Overlay[]>([]);
  const serverOverlaysRef = useRef<Overlay[]>(serverOverlays);
  useEffect(() => { serverOverlaysRef.current = serverOverlays; }, [serverOverlays]);
  const serverSigRef = useRef<string>("");
  const lastGoodAtRef = useRef<number>(0);
  const lastEventAtRef = useRef<number>(0);
  const connectedRef = useRef<boolean>(false);
  const hasEverConnectedRef = useRef<boolean>(false);
  // Persist the last known-good snapshot that had at least one enabled overlay
  const lastStableOverlaysRef = useRef<Overlay[]>([]);
  // Persist the last non-empty list from any source (prop/local/server) to avoid dropping overlays on transient blanks
  const lastNonEmptyRef = useRef<Overlay[]>([]);

  const lastFetchFailedRef = useRef<boolean>(false);

  // Debouncing for server overlay updates
  const pendingUpdateRef = useRef<number | null>(null);
  const UPDATE_DEBOUNCE_MS = 100;

  const setServerOverlaysIfChanged = useCallback(
    (next: Overlay[]) => {
      // Clear pending debounced update
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }

      // Debounce rapid updates
      pendingUpdateRef.current = window.setTimeout(() => {
        const merged = mergeSnapshots(serverOverlaysRef.current, next);
        const sig = jsonStable(merged);

        // Debug scoreboard changes
        // const nextScoreboards = next?.filter(o => String(o?.type).toLowerCase() === 'scoreboard') || [];
        // const currentScoreboards = serverOverlays?.filter(o => String(o?.type).toLowerCase() === 'scoreboard') || [];

        // if (nextScoreboards.length > 0 || currentScoreboards.length > 0) {
        //   console.log('[SSE/Poll] 🎯 Scoreboard overlay change detected:', {
        //     from: currentScoreboards.map(s => ({ id: s.id?.substring(0, 20), enabled: s.enabled })),
        //     to: nextScoreboards.map(s => ({ id: s.id?.substring(0, 20), enabled: s.enabled })),
        //     signatureChanged: sig !== serverSigRef.current
        //   });
        // }

        if (sig !== serverSigRef.current) {
          // console.log('[SSE/Poll] 📡 Server overlay update:', {
          //   source: 'setServerOverlaysIfChanged',
          //   prevSignature: serverSigRef.current?.substring(0, 8),
          //   newSignature: sig?.substring(0, 8),
          //   overlayCount: merged?.length,
          //   scoreboards: merged?.filter(o => String(o?.type).toLowerCase() === 'scoreboard')?.length
          // });

          serverSigRef.current = sig;
          setServerOverlays(merged);
        }
        // Update freshness markers and last stable cache when we have any enabled overlays
        const hasEnabled = enabledOnlyLocal(merged).length > 0;
        if (hasEnabled) {
          lastStableOverlaysRef.current = merged;
          lastGoodAtRef.current = Date.now();
        }
        lastFetchFailedRef.current = false;
        pendingUpdateRef.current = null;
      }, UPDATE_DEBOUNCE_MS);
    },
    [] // stable — reads serverOverlays via ref to avoid SSE effect re-subscribe churn
  );

  const fetchServerOverlays = useCallback(
    async (eid: string | number | null) => {
      if (!db || !eid) return;
      try {
        const tryFetch = async (val: any) => db.selectData({ tableName: "livestream_event_overlay", where: { exact: { event_id: val } } });

        // Try with the raw value, then with numeric fallback to avoid type mismatches in the DB driver
        let res = await tryFetch(eid);
        let rows = Array.isArray(res?.data) ? res.data : [];

        // console.log('[SSE/Poll] 📥 overlay fetch', {
        //   eventId: eid,
        //   rows: rows.length,
        //   sample: rows[0] ? Object.keys(rows[0]) : null,
        // });

        if (!rows.length) {
          const num = Number(eid);
          if (Number.isFinite(num)) {
            res = await tryFetch(num);
            rows = Array.isArray(res?.data) ? res.data : rows;
            // console.log('[SSE/Poll] 📥 overlay fetch (numeric retry)', {
            //   eventId: num,
            //   rows: rows.length,
            //   sample: rows[0] ? Object.keys(rows[0]) : null,
            // });
          }
        }

        let canon: Overlay[] = [];
        if (rows.length > 0) {
          const first = rows[0] || {};
          if (first.state != null) {
            const raw = parseOverlays(first.state);
            canon = normalizeOverlayArray(raw) as Overlay[];
            // console.log('[SSE/Poll] 📦 overlay state(row.state)', { count: Array.isArray(raw) ? raw.length : null, canon: canon.length });
          } else if (first.type != null || rows.length > 1) {
            canon = normalizeOverlayArray(rowsToCanon(rows)) as Overlay[];
            // console.log('[SSE/Poll] 📦 overlay rows->canon', { rows: rows.length, canon: canon.length });
          } else {
            console.log('[SSE/Poll] ⚠️ overlay row unexpected shape', first);
          }
          connectedRef.current = true;
          hasEverConnectedRef.current = true;
          setServerOverlaysIfChanged(Array.isArray(canon) ? canon : []);
          return;
        }
        // Respect explicit empties so disable/clear propagates immediately
        connectedRef.current = true;
        hasEverConnectedRef.current = true;
        setServerOverlaysIfChanged([]);
      } catch {
        lastFetchFailedRef.current = true;
        /* keep last good state */
      }
    },
    [db, setServerOverlaysIfChanged]
  );

  // live SSE updates
  const sseThrottleRef = useRef<{ lastRun: number; timeout: ReturnType<typeof setTimeout> | null }>({ lastRun: 0, timeout: null });
  useEffect(() => {
    if (effectiveSource !== "server" || !eventId || !useSSE) return;
    const eid = String(eventId);
    const url =
      (db as any)?.overlayStreamUrl?.(eid) || overlayStreamPath(eid);
    const THROTTLE_MS = 200;
    const unsub = getOverlayStream(eid, url, () => {
      const now = Date.now();
      connectedRef.current = true;
      hasEverConnectedRef.current = true;
      lastEventAtRef.current = now;
      const { lastRun, timeout } = sseThrottleRef.current;
      if (timeout) {
        clearTimeout(timeout);
        sseThrottleRef.current.timeout = null;
      }
      if (now - lastRun >= THROTTLE_MS) {
        sseThrottleRef.current.lastRun = now;
        void fetchServerOverlays(eid);
      } else {
        const delay = THROTTLE_MS - (now - lastRun);
        sseThrottleRef.current.timeout = setTimeout(() => {
          sseThrottleRef.current.lastRun = Date.now();
          sseThrottleRef.current.timeout = null;
          void fetchServerOverlays(eid);
        }, delay);
      }
    });
    void fetchServerOverlays(eid);
    return () => {
      unsub?.();
      connectedRef.current = false;
      if (sseThrottleRef.current.timeout) {
        clearTimeout(sseThrottleRef.current.timeout);
        sseThrottleRef.current.timeout = null;
      }
    };
  }, [effectiveSource, eventId, useSSE, fetchServerOverlays, db]);

  // polling fallback
  useEffect(() => {
    if (effectiveSource !== "server" || !eventId) return;
    const ms = Math.max(useSSE ? 15000 : 5000, pollMs ?? 15000);
    const id = window.setInterval(() => {
      // When SSE is enabled, only poll if we haven't seen activity recently.
      if (useSSE) {
        const last = lastEventAtRef.current || 0;
        const age = Date.now() - last;
        if (last && age < 10000) return;
      }
      void fetchServerOverlays(eventId);
    }, ms);
    return () => window.clearInterval(id);
  }, [effectiveSource, eventId, pollMs, useSSE, fetchServerOverlays]);

  // choose list + enabled
  const hasScoreboard = (arr: Overlay[]) => arr.some((o) => normType(o.type) === 'scoreboard' && (o as any)?.enabled === true);

  const list: Overlay[] = useMemo(() => {
    const coerceList = (value?: Overlay[] | null) => (Array.isArray(value) ? value : []);

    if (effectiveSource === "prop") {
      const propList = coerceList(overlays);
      lastNonEmptyRef.current = propList;
      return propList;
    }

    if (effectiveSource === "server") {
      const serverList = coerceList(serverOverlays);
      // Always honor the latest server snapshot (including empty) when fetch succeeds
      lastNonEmptyRef.current = serverList;
      const stable = lastStableOverlaysRef.current;
      const stableEnabled = enabledOnlyLocal(stable).length > 0;
      const lastGoodAge = lastGoodAtRef.current ? Date.now() - lastGoodAtRef.current : Infinity;
      const shouldHoldStable = serverList.length === 0 && !lastFetchFailedRef.current && stableEnabled && lastGoodAge < 15000;
      if (shouldHoldStable) return stable;
      if (!lastFetchFailedRef.current) return serverList;

      // On fetch failure, fall back to last stable enabled snapshot to avoid blanking
      if (stableEnabled) return stable;
      if (lastNonEmptyRef.current.length) return lastNonEmptyRef.current;
      return serverList;
    }

    const localList = coerceList(localOverlays);
    lastNonEmptyRef.current = localList;
    return localList;
  }, [effectiveSource, overlays, serverOverlays, localOverlays]);

  const enabled = useMemo(() => {
    const result = enabledOnlyLocal(list);
    if (result.length) {
      lastStableOverlaysRef.current = list;
      lastNonEmptyRef.current = list;
    }
    // console.log('[CanopyEngine] 🔍 Filtering enabled overlays:', {
    //   inputList: list?.map(o => ({ id: o.id?.substring(0, 20), type: o.type, enabled: o.enabled })),
    //   enabledResult: result?.map(o => ({ id: o.id?.substring(0, 20), type: o.type, enabled: o.enabled })),
    //   scoreboards: result?.filter(o => normType(o.type) === 'scoreboard')
    // });
    return result;
  }, [list]);

  // group by type
  const groups = useMemo(() => {
    const scoreboards = enabled.filter((o) => normType(o.type) === "scoreboard");
    const ticker = enabled.filter((o) => normType(o.type) === "ticker");
    const maps = enabled.filter((o) => normType(o.type) === "map");
    const other = enabled.filter((o) => !["scoreboard", "ticker", "map"].includes(normType(o.type)));
    const result = { scoreboards, ticker, maps, other };

    // ALWAYS log scoreboard debugging
    // console.log("[CanopyEngine] 🎯 Scoreboard Debug - source=", effectiveSource, {
    //   listCount: list?.length ?? 0,
    //   enabled: enabled.length,
    //   scoreboards: scoreboards.length,
    //   scoreboardDetails: scoreboards.map(s => ({ id: s.id?.substring(0, 20), enabled: s.enabled, type: s.type })),
    //   groups: {
    //     scoreboards: scoreboards.length,
    //     ticker: ticker.length,
    //     maps: maps.length,
    //     other: other.length,
    //   },
    // });

    return result;
  }, [enabled, effectiveSource, list]);

  const primaryScore = groups.scoreboards[0];

  // status for UI
  const status = useMemo(() => {
    const now = Date.now();
    const lastGoodAt = lastGoodAtRef.current || 0;
    const lastEventAt = lastEventAtRef.current || 0;
    const ageMs = lastGoodAt ? now - lastGoodAt : undefined;
    const isStale = effectiveSource === 'server' && !!ageMs && ageMs > 10000; // 10s
    // Once we have any stable overlays, don't show "connecting"; prefer stale ribbon
    const hasStable = enabledOnlyLocal(lastStableOverlaysRef.current).length > 0;
    const connecting = effectiveSource === 'server'
      && !hasEverConnectedRef.current
      && enabled.length === 0
      && !hasStable;
    return {
      source: effectiveSource,
      connecting,
      isStale,
      ageMs,
      lastGoodAt,
      lastEventAt,
    } as const;
  }, [effectiveSource, enabled.length]);

  // Cleanup effect for debounced updates
  useEffect(() => {
    return () => {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    };
  }, []);

  return { effectiveSource, list, enabled, groups, primaryScore, status } as const;
}
