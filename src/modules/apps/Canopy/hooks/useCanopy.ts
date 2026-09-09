
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getService } from "@webstack/common";
import IDataBaseService from "~/src/core/services/DataBaseService/IDataBaseService";
import { CanonOverlay, normalizeOverlayArray, jsonStable } from "../models/canopyOverlayTypes";
import { debugOverlayState } from "../models/overlayDebug";
import { SaveOverlaysOptions } from "../context/CanopyProvider";
import { useUser, useClearance } from "~/src/core/authentication/hooks/useUser";

/* ---------------- types ---------------- */

export type Json = any;

export type EventRow = {
  id: string;
  name: string;
  starts_at?: string | null;
  ends_at?: string | null;
  timezone?: string | null;
  is_live?: boolean | null;
  overlays?: any[] | null;
  lat?: number | null;
  lng?: number | null;
  design_width?: number | null;
  design_height?: number | null;
  user_id?: string | null;
  stripe_id?: string | null;
  // Legacy/camel variants accepted from API responses
  designWidth?: number | null;
  designHeight?: number | null;
  design_w?: number | null;
  design_h?: number | null;
};

export type RosterRow = {
  id: number | string;
  event_id: number | string;
  team_name: string;
  vehicle_number?: string | number | null;
  competitors?: Array<{ id: string; name?: string | null; position?: number | null; role?: string | null }>;
  has_gps?: boolean | null;
  gps_data?: { last_fix?: any; created_at?: string | null; updated_at?: string | null } | null;
  score?: number | null;
  color?: string | null;
};

export type OverlayDBRow = {
  id?: string | number;
  event_id: string | number;
  type: string;
  enabled?: boolean | null;
  x?: number | null;
  y?: number | null;
  z_index?: number | null;
  variant?: string | null;
  animation?: string | null;
  title?: string | null;
  description?: string | null;
  data?: any | null;
};

type OverlayAggregateRow = { event_id: string | number; state?: Json };

/* ---------------- config ---------------- */
const aliasType = (t: unknown) => {
  const s = String(t || "").toLowerCase();
  return s === "leaderboard" ? "scoreboard" : s;
};

const TABLE_EVENT = "livestream_event";
const TABLE_OVERLAY = "livestream_event_overlay";
// Single source: backend enriches base event_team rows with competitors[] and optional gps
const TABLE_ROSTER = "event_team";
const TABLE_OVERLAY_MODE: "rows" | "aggregate" = "aggregate";

/* ---------------- internal helpers ---------------- */
const toScore = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const hashArr = (a: any[]) => jsonStable(a);

const getApiBaseFromDb = (db: any): string | null => {
  const base = db?.baseUrl || db?.getBaseUrl?.() || process.env.NEXT_PUBLIC_API_BASE;

  // console.log("[ base 1 ]", base)
  return base ? String(base).replace(/\/+$/, "") : null;
};

// Prefer browser TZ; fall back to env or a stable default
const getDefaultTimezone = (): string => {
  try {
    const tz = Intl?.DateTimeFormat?.().resolvedOptions().timeZone;
    if (tz && typeof tz === "string" && tz.includes("/")) return tz;
  } catch { }
  return process.env.NEXT_PUBLIC_DEFAULT_TZ || "America/Denver";
};

/* ---------------- hook ---------------- */

export function useCanopy() {
  const db = useMemo(() => getService<IDataBaseService>("IDataBaseService"), []);
  const mounted = useRef(true);


  // single-flight guards
  const inflight = useRef<Map<string, Promise<any>>>(new Map());

  // per-event debouncers for overlay saves
  const saveTimers = useRef<Map<string, number>>(new Map());
  const lastSavedHash = useRef<Map<string, string>>(new Map());

  // simple caches
  const rosterCache = useRef<Map<string, RosterRow[]>>(new Map());
  const overlayCache = useRef<Map<string, CanonOverlay[]>>(new Map());

  // **NEW**: fetch cooldowns (ms) per table+event to prevent bursts
  const lastFetchTs = useRef<Map<string, number>>(new Map());
  const MIN_ROSTER_MS = 1500;   // gentle: UI can still force:true

  const withSingleFlight = useCallback(async (key: string, fn: () => Promise<any>) => {
    if (inflight.current.has(key)) return inflight.current.get(key)!;
    const p = fn().finally(() => { inflight.current.delete(key); });
    inflight.current.set(key, p);
    return p;
  }, []);

  /* ========== events ========== */
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [errorEvents, setErrorEvents] = useState<unknown>(null);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setErrorEvents(null);
    try {
      const res = await withSingleFlight("events:list", async () =>
        db.selectData({ tableName: TABLE_EVENT })
      );
      const toNumOrNull = (v: any) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const list: EventRow[] = (res?.data ?? []).map((e: any) => ({
        ...e,
        timezone: e?.timezone ?? getDefaultTimezone(),
        design_width: toNumOrNull(e?.design_width ?? e?.designWidth ?? e?.design_w),
        design_height: toNumOrNull(e?.design_height ?? e?.designHeight ?? e?.design_h),
      }));
      // Backfill missing timezone in DB (non-blocking)
      try {
        const toPatch = (res?.data ?? []).filter((e: any) => !e?.timezone);
        if (toPatch.length > 0) {
          const tz = getDefaultTimezone();
          await Promise.all(
            toPatch.map((e: any) =>
              db.updateData({ tableName: TABLE_EVENT, set: { timezone: tz }, where: { exact: { id: e.id } } })
            )
          );
        }
      } catch { /* ignore */ }
      if (mounted.current) setEvents(list);
    } catch (err) {
      if (mounted.current) { setEvents([]); setErrorEvents(err); }
    } finally {
      if (mounted.current) setLoadingEvents(false);
    }
  }, [db, withSingleFlight]);

  const deleteEvent = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Delete children first (safer if DB has FK constraints)
      await db.deleteData({ tableName: TABLE_OVERLAY, where: { event_id: id } });
      await db.deleteData({ tableName: TABLE_ROSTER, where: { event_id: id } });
      // Delete the event itself (flat where shape expected by service)
      await db.deleteData({ tableName: TABLE_EVENT, where: { id } });

      // Update local state/cache so UI reflects deletion immediately
      if (mounted.current) {
        setEvents(prev => (prev ? prev.filter(e => String(e.id) !== String(id)) : prev));
        overlayCache.current.delete(String(id));
        rosterCache.current.delete(String(id));
        lastSavedHash.current.delete(String(id));
      }
      return true;
    } catch (error) {
      console.error("Error deleting event:", error);
      return false;
    }
  }, [db]);

  // Delete only the event row (may cascade depending on DB FKs)
  const deleteEventOnly = useCallback(async (id: string): Promise<boolean> => {
    try {
      await db.deleteData({ tableName: TABLE_EVENT, where: { id } });
      if (mounted.current) {
        setEvents(prev => (prev ? prev.filter(e => String(e.id) !== String(id)) : prev));
        overlayCache.current.delete(String(id));
        rosterCache.current.delete(String(id));
        lastSavedHash.current.delete(String(id));
      }
      return true;
    } catch (error) {
      console.error('deleteEventOnly failed', error);
      return false;
    }
  }, [db]);

  const setLiveEvent = useCallback(async (eventId: string): Promise<boolean> => {
    try {
      // Allow multiple events to be live simultaneously
      await db.updateData({ tableName: TABLE_EVENT, set: { is_live: true }, where: { exact: { id: eventId } } });
      const res = await db.selectData({ tableName: TABLE_EVENT });
      const toNum = (v: any) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null; };
      const list: EventRow[] = (res?.data ?? []).map((e: any) => ({
        ...e,
        timezone: e?.timezone ?? getDefaultTimezone(),
        design_width: toNum(e?.design_width ?? e?.designWidth ?? e?.design_w),
        design_height: toNum(e?.design_height ?? e?.designHeight ?? e?.design_h),
      }));
      if (mounted.current) setEvents(list);
      return true;
    } catch {
      return false;
    }
  }, [db]);

  const createEvent = useCallback(async (values: Partial<EventRow> & { name: string }): Promise<EventRow | null> => {
    try {
      const payload = {
        name: values.name,
        starts_at: values.starts_at ?? null,
        ends_at: values.ends_at ?? null,
        timezone: values.timezone ?? getDefaultTimezone(),
        is_live: values.is_live ?? false,
        design_width: values.design_width ?? 1920,
        design_height: values.design_height ?? 1080,
      };
      const res = await db.insertData({ tableName: TABLE_EVENT, values: payload as any });
      const row = Array.isArray(res?.data) ? (res.data[0] as EventRow) : null;
      if (row && mounted.current) setEvents(prev => (prev ? [row, ...prev] : [row]));
      return row ?? null;
    } catch {
      return null;
    }
  }, [db]);

  const renameEvent = useCallback(async (eventId: string, name: string): Promise<boolean> => {
    try {
      await db.updateData({ tableName: TABLE_EVENT, set: { name }, where: { exact: { id: eventId } } });
      if (mounted.current) {
        setEvents(prev => (prev ? prev.map(e => (String(e.id) === String(eventId) ? { ...e, name } : e)) : prev));
      }
      return true;
    } catch {
      return false;
    }
  }, [db]);

  useEffect(() => {
    mounted.current = true;
    if (events === null) void loadEvents();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ========== roster ========== */
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [errorRoster, setErrorRoster] = useState<unknown>(null);

  const loadRoster = useCallback(
    async (eventId?: string, { force = false }: { force?: boolean } = {}) => {
      if (!eventId) { if (mounted.current) setRoster(null); return; }

      const key = String(eventId);

      // cooldown: avoid hammering event_team when multiple sources call at once
      if (!force) {
        const k = `roster:${key}`;
        const now = Date.now();
        const last = lastFetchTs.current.get(k) ?? 0;
        if (now - last < MIN_ROSTER_MS) {
          // serve from cache if available
          if (rosterCache.current.has(key) && mounted.current) {
            setRoster(rosterCache.current.get(key)!);
          }
          return;
        }
        lastFetchTs.current.set(k, now);
      }

      if (!force && rosterCache.current.has(key)) {
        if (mounted.current) setRoster(rosterCache.current.get(key)!);
        return;
      }

      setLoadingRoster(true);
      setErrorRoster(null);
      try {
        const res = await withSingleFlight(`roster:${eventId}`, async () =>
          db.selectData({ tableName: TABLE_ROSTER, where: { exact: { event_id: eventId } } })
        );
        const rows: RosterRow[] = (res?.data ?? []).map((r: any) => ({
          // be lenient about id field name coming from different views
          id: r.id ?? r.team_id ?? r.event_team_id ?? r.event_teamid ?? r.roster_id,
          event_id: r.event_id,
          team_name: r.team_name ?? "",
          vehicle_number: r.vehicle_number ?? null,
          competitors: Array.isArray(r?.competitors) ? r.competitors : [],
          has_gps: typeof r?.has_gps === 'boolean' ? r.has_gps : (r?.gps_data?.last_fix ? true : false),
          gps_data: r?.gps_data ?? null,
          score: toScore(r.score),
          color: r.color ?? null,
        }));
        rosterCache.current.set(key, rows);
        if (mounted.current) setRoster(rows);
      } catch (err) {
        setErrorRoster(err);
        rosterCache.current.delete(key);
        if (mounted.current) setRoster([]);
      } finally {
        if (mounted.current) setLoadingRoster(false);
      }
    },
    [db, withSingleFlight]
  );

  /* ========== overlays (server) ========== */
  const [overlays, setOverlays] = useState<CanonOverlay[] | null>(null);
  const [loadingOverlays, setLoadingOverlays] = useState(false);
  const [errorOverlays, setErrorOverlays] = useState<unknown>(null);

  const getOverlaysById = useCallback(
    async (eventId: string, { force = false }: { force?: boolean } = {}): Promise<CanonOverlay[] | null> => {
      const key = String(eventId);
      if (!force && overlayCache.current.has(key)) {
        const cached = overlayCache.current.get(key)!;
        if (mounted.current) {
          setOverlays(cached);
          lastSavedHash.current.set(eventId, hashArr(cached));
        }
        return cached;
      }

      setLoadingOverlays(true);
      setErrorOverlays(null);
      try {
        const res = await withSingleFlight(`overlay:get:${eventId}`, async () =>
          db.selectData({ tableName: TABLE_OVERLAY, where: { exact: { event_id: eventId } } })
        );

        let canon: CanonOverlay[] = [];

        if (TABLE_OVERLAY_MODE === "rows") {
          const rows: OverlayDBRow[] = Array.isArray(res?.data) ? (res.data as OverlayDBRow[]) : [];
          const arr = rows.map((r) => ({
            id: r.id ?? undefined,
            type: aliasType(r.type),
            enabled: Boolean(r.enabled),
            x: Number(r.x ?? 0),
            y: Number(r.y ?? 0),
            z_index: Number(r.z_index ?? 1),
            variant: r.variant ?? null,
            animation: r.animation ?? null,
            title: r.title ?? null,
            description: r.description ?? null,
            data: r.data ?? null,
          }));
          canon = normalizeOverlayArray(arr);
        } else {
          const row: OverlayAggregateRow | undefined = Array.isArray(res?.data) ? (res.data[0] as OverlayAggregateRow) : undefined;
          let state: any[] | null = null;
          if (Array.isArray(row?.state)) state = row.state;
          else if (typeof row?.state === "string") {
            try { const j = JSON.parse(row.state); if (Array.isArray(j)) state = j; } catch { }
          }
          canon = normalizeOverlayArray(state ?? []);
        }

        overlayCache.current.set(key, canon);
        if (mounted.current) {
          setOverlays(canon);
          lastSavedHash.current.set(eventId, hashArr(canon));
        }
        return canon;
      } catch (err) {
        // Preserve last known overlays on transient failures to avoid visual cut-outs
        setErrorOverlays(err);
        const fallback = overlayCache.current.get(key) ?? null;
        if (mounted.current && fallback) {
          // keep showing previous overlays; do not clear
          setOverlays(fallback);
        }
        return fallback;
      } finally {
        if (mounted.current) setLoadingOverlays(false);
      }
    },
    [db, withSingleFlight]
  );

  const saveOverlaysById = useCallback(
    async (eventId: string, payload: any[], options: SaveOverlaysOptions = {}): Promise<boolean> => {
      const { force = false } = options;

      const ensureRealIds = (arr: any[]) =>
        (arr ?? []).map((o) => {
          if (o?.id && typeof o.id === 'string') return o;
          const t = String(o?.type || 'overlay').toLowerCase() || 'overlay';
          const id = `${t}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          return { ...o, id };
        });

      const sanitized = ensureRealIds(normalizeOverlayArray(payload ?? []));

      // console.log(`🔍 [saveOverlaysById] Input payload:`, payload?.map(o => ({ id: o.id?.substring(0, 20), type: o.type, enabled: o.enabled })));
      // console.log(`🔍 [saveOverlaysById] Final sanitized:`, sanitized?.map(o => ({ id: o.id?.substring(0, 20), type: o.type, enabled: o.enabled })));

      const nextHash = hashArr(sanitized);
      const prevHash = lastSavedHash.current.get(eventId);

      if (!force && prevHash && prevHash === nextHash) {
        if (mounted.current) setOverlays(sanitized);
        return true;
      }

      try {
        // console.log(`🔍 [saveOverlaysById] TABLE_OVERLAY_MODE = "${TABLE_OVERLAY_MODE}"`);
        // console.log(`🔍 [saveOverlaysById] Saving ${sanitized.length} overlays for event ${eventId}`);

        const numericEventId = Number(eventId);
        const eventIdForWhere = Number.isFinite(numericEventId) ? numericEventId : eventId;

        if (TABLE_OVERLAY_MODE === "rows") {
          // console.log(`📊 [saveOverlaysById] Using ROWS mode - saving individual overlay types`);
          const existingRes = await db.selectData({
            tableName: TABLE_OVERLAY,
            where: { exact: { event_id: eventIdForWhere } },
          });
          const existing: OverlayDBRow[] = Array.isArray(existingRes?.data) ? existingRes.data : [];
          const byType = new Map<string, OverlayDBRow>();
          for (const r of existing) byType.set(String(r.type).toLowerCase(), r);

          const seenTypes = new Set<string>();
          for (const ov of sanitized) {
            const t = aliasType(ov.type);
            seenTypes.add(t);
            const rowShape: Record<string, any> = {
              event_id: eventId,
              type: t,
              enabled: !!ov.enabled,
              x: Number(ov.x ?? 0),
              y: Number(ov.y ?? 0),
              z_index: Number(ov.z_index ?? 1),
              variant: ov.variant ?? null,
              animation: ov.animation ?? null,
              title: ov.title ?? null,
              description: ov.description ?? null,
              data: ov.data ?? null,
            };

            const existingRow = byType.get(t);
            if (existingRow) {
              await db.updateData({
                tableName: TABLE_OVERLAY,
                set: rowShape,
                where: { exact: { event_id: eventIdForWhere, type: t } },
              });
            } else {
              await db.insertData({
                tableName: TABLE_OVERLAY,
                values: rowShape,
              });
            }
          }

          for (const r of existing) {
            const t = String(r.type).toLowerCase();
            if (!seenTypes.has(t)) {
              await db.deleteData({
                tableName: TABLE_OVERLAY,
                where: { exact: { event_id: eventIdForWhere, type: t } },
              });
            }
          }
        } else {
          // console.log(`📦 [saveOverlaysById] Using AGGREGATE mode - saving full overlay array`);
          // console.log(`📦 [saveOverlaysById] Sanitized overlays:`, sanitized.map(o => ({ id: o.id, type: o.type, enabled: o.enabled })));

          // legacy aggregate: store raw array (not JSON string)
          try {
            const upd = await db.updateData({
              tableName: TABLE_OVERLAY,
              set: { state: sanitized },
              where: { exact: { event_id: eventIdForWhere } },
            });

            if (!upd || (Array.isArray((upd as any).data) && (upd as any).data.length === 0)) {
              await db.insertData({
                tableName: TABLE_OVERLAY,
                values: { event_id: eventIdForWhere, state: sanitized },
              });
            }
          } catch {
            await db.insertData({
              tableName: TABLE_OVERLAY,
              values: { event_id: eventIdForWhere, state: sanitized },
            });
          }
        }

        if (mounted.current) {
          overlayCache.current.set(String(eventId), sanitized);
          setOverlays(sanitized);
          lastSavedHash.current.set(eventId, nextHash);
        }

        try {
          if (typeof (db as any).pingOverlay === "function") {
            await (db as any).pingOverlay(eventId);
          } else {
            const base = getApiBaseFromDb(db);
            if (base) {
              await fetch(`${base}/db/overlay_ping?event_id=${encodeURIComponent(String(eventId))}`, {
                method: "POST",
                keepalive: true,
              });
            }
          }
        } catch { /* non-fatal */ }

        return true;
      } catch (err) {
        setErrorOverlays(err);
        return false;
      }
    },
    [db]
  );

  const saveOverlaysDebounced = useCallback((eventId: string, payload: any[], ms = 200) => {
    const key = `save:${eventId}`;
    const existing = saveTimers.current.get(key);
    if (existing) window.clearTimeout(existing);
    const t = window.setTimeout(() => { void saveOverlaysById(eventId, payload); }, ms);
    saveTimers.current.set(key, t as unknown as number);
  }, [saveOverlaysById]);

  const hydrateOverlaysFromRoster = useCallback(async (eventId: string, title?: string) => {
    if (!eventId) return;
    await loadRoster(eventId);
    const rows = rosterCache.current.get(String(eventId)) ?? [];
    // Include both `number` (legacy) and `vehicle_number` so downstream renderers
    // and any older controls remain in sync without showing "-".
    const teams = rows.map(r => ({
      name: r.team_name,
      number: r.vehicle_number ?? "",
      vehicle_number: r.vehicle_number ?? "",
      score: toScore(r.score),
    }));

    const state = normalizeOverlayArray([
      { id: "scoreboard", type: "scoreboard", enabled: true, z_index: 1, title: title ?? "Scoreboard", description: "", data: { teams } },
      { id: "ticker", type: "ticker", enabled: false, z_index: 1, title: title ?? "", description: "", data: { items: [] } },
      { id: "map", type: "map", enabled: false, z_index: 1, title: title ?? "", description: "", data: { items: [] } },
    ]);

    saveOverlaysDebounced(eventId, state, 0);
  }, [loadRoster, saveOverlaysDebounced]);

  const duplicateEvent = useCallback(async (sourceEventId: string, stripeId?: string): Promise<EventRow | null> => {
    try {
      // 1. Read source event
      const srcRes = await db.selectData({ tableName: TABLE_EVENT, where: { exact: { id: sourceEventId } } });
      const srcEvent: EventRow | undefined = Array.isArray(srcRes?.data) ? srcRes.data[0] : undefined;
      if (!srcEvent) throw new Error("Source event not found");

      // 2. Insert new event with copied fields, fresh times, is_live=false
      const now = new Date();
      const plus1h = new Date(now.getTime() + 60 * 60 * 1000);
      const eventPayload: Record<string, any> = {
        name: `Copy of ${srcEvent.name}`,
        starts_at: now.toISOString(),
        ends_at: plus1h.toISOString(),
        timezone: srcEvent.timezone ?? getDefaultTimezone(),
        is_live: false,
        lat: srcEvent.lat ?? null,
        lng: srcEvent.lng ?? null,
        design_width: srcEvent.design_width ?? 1920,
        design_height: srcEvent.design_height ?? 1080,
        css_url: (srcEvent as any)?.css_url ?? null,
        css_text: (srcEvent as any)?.css_text ?? null,
      };
      if (stripeId) eventPayload.stripe_id = stripeId;
      else if (srcEvent.stripe_id) eventPayload.stripe_id = srcEvent.stripe_id;
      if (srcEvent.user_id) eventPayload.user_id = srcEvent.user_id;

      const insertRes = await db.insertData({ tableName: TABLE_EVENT, values: eventPayload } as any);
      // The backend returns the full inserted row (with RETURNING *), use it directly
      const inserted = Array.isArray(insertRes?.data) ? insertRes.data[0] : (insertRes?.data ?? null);
      const newId = inserted?.id ?? inserted?.event_id;
      if (!newId) throw new Error("Event duplicated but no id returned.");

      // Use the actual DB response as the canonical new event row
      const created: EventRow = {
        ...inserted,
        id: String(newId),
        timezone: inserted?.timezone ?? eventPayload.timezone,
        design_width: inserted?.design_width ?? eventPayload.design_width,
        design_height: inserted?.design_height ?? eventPayload.design_height,
      } as EventRow;

      // 3. Clone overlays (aggregate mode: single row with state JSONB)
      // Use numeric event IDs for DB where clauses (matches backend BIGINT columns)
      const numericSourceId = Number(sourceEventId);
      const sourceIdForWhere = Number.isFinite(numericSourceId) ? numericSourceId : sourceEventId;
      const numericNewId = Number(newId);
      const newIdForInsert = Number.isFinite(numericNewId) ? numericNewId : newId;

      const ovRes = await db.selectData({ tableName: TABLE_OVERLAY, where: { exact: { event_id: sourceIdForWhere } } });
      const ovRow = Array.isArray(ovRes?.data) ? ovRes.data[0] : undefined;
      if (ovRow) {
        let state: any[] | null = null;
        if (Array.isArray((ovRow as any)?.state)) state = (ovRow as any).state;
        else if (typeof (ovRow as any)?.state === "string") {
          try { const j = JSON.parse((ovRow as any).state); if (Array.isArray(j)) state = j; } catch { }
        }
        if (state && state.length > 0) {
          // Regenerate overlay IDs to avoid collisions with source event
          const cloned = state.map((o: any, i: number) => ({
            ...o,
            id: `${String(o?.type || "overlay").toLowerCase()}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
          }));
          // Route through saveOverlaysById for canonical upsert + cache warming,
          // so the newly-selected event renders its overlays without a reload.
          const ok = await saveOverlaysById(String(newId), cloned, { force: true });
          if (!ok) console.warn("duplicateEvent: overlay clone did not persist for new event", newId);
        }
      }

      // 4. Clone roster rows
      try {
        const rosterRes = await db.selectData({ tableName: TABLE_ROSTER, where: { exact: { event_id: sourceIdForWhere } } });
        const rosterRows: any[] = Array.isArray(rosterRes?.data) ? rosterRes.data : [];
        for (const row of rosterRows) {
          const { id: _id, ...rest } = row;
          await db.insertData({ tableName: TABLE_ROSTER, values: { ...rest, event_id: newIdForInsert } } as any);
        }
      } catch { /* roster clone failed — non-fatal */ }

      // 5. Update local events state
      if (mounted.current) setEvents(prev => (prev ? [created, ...prev] : [created]));
      return created;
    } catch (err) {
      console.error("duplicateEvent failed:", err);
      return null;
    }
  }, [db, saveOverlaysById]);

  const overlayStreamUrlFor = useCallback((eventId: string | number): string | null => {
    const svc: any = db as any;
    if (typeof svc.overlayStreamUrl === "function") {
      return svc.overlayStreamUrl(eventId);
    }
    const base = getApiBaseFromDb(db);
    return base ? `${base}/db/overlay_stream?event_id=${encodeURIComponent(String(eventId))}` : null;
  }, [db]);

  return {
    // events
    events, loadingEvents, errorEvents, loadEvents, deleteEvent,
    setLiveEvent, createEvent, renameEvent,
    deleteEventOnly, duplicateEvent,
    // roster
    roster, loadingRoster, errorRoster, loadRoster,
    // overlays (server)
    overlays, loadingOverlays, errorOverlays, getOverlaysById,
    saveOverlaysById,
    saveOverlaysDebounced,
    // helpers
    hydrateOverlaysFromRoster,
    overlayStreamUrlFor,
  };
}
