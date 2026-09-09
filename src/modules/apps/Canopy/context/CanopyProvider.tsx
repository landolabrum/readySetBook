
import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useEffect,
  PropsWithChildren,
} from 'react';

/* =========================================================================================
   1) LiveStreamProvider (context)  —  prevents repeated prefetches and over-polling
   ========================================================================================= */

import { useCanopy } from '../hooks/useCanopy';
import { coerceEnabled } from '../models/canopyOverlayTypes';

type LiveStreamCtxValue = ReturnType<typeof useCanopy> & {
  eventId?: string | number;
};

export const LiveStreamCtx = createContext<LiveStreamCtxValue | null>(null);
export type SaveOverlaysOptions = { force?: boolean };

type Sub = () => void;
type PoolEntry = {
  es: EventSource;
  subs: Set<Sub>;
  refCount: number;
};

type PoolEntryWithHealth = PoolEntry & {
  lastActivity: number;
  connectionState: 'connecting' | 'open' | 'error' | 'closed';
  errorCount: number;
  createdAt: number;
};

const ssePool = new Map<string, PoolEntryWithHealth>();
const SSE_TIMEOUT = 30000; // 30 seconds
const MAX_ERROR_COUNT = 15; // raised from 3 — EventSource auto-reconnect fires onerror on each attempt
const CONNECTION_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours — long-running streams must not churn SSE
const ERROR_DECAY_INTERVAL = 60000; // decay errorCount by 1 every 60s so transient bursts don't accumulate

// Cleanup stale connections + decay error counts periodically
setInterval(() => {
  const now = Date.now();

  // Decay error counts so transient bursts don't permanently accumulate
  for (const [, entry] of ssePool) {
    if (entry.errorCount > 0 && entry.connectionState !== 'closed') {
      entry.errorCount = Math.max(0, entry.errorCount - 1);
    }
  }

  const staleEntries = Array.from(ssePool.entries()).filter(([, entry]) => {
    const isStale = (now - entry.lastActivity) > SSE_TIMEOUT;
    const isTooOld = (now - entry.createdAt) > CONNECTION_MAX_AGE;
    const hasTooManyErrors = entry.errorCount >= MAX_ERROR_COUNT;
    return (isStale || isTooOld || hasTooManyErrors) && entry.refCount <= 0;
  });

  staleEntries.forEach(([key, entry]) => {
    try {
      entry.es.close();
    } catch { }
    ssePool.delete(key);
  });
}, ERROR_DECAY_INTERVAL); // Check + decay every minute

// Shared SSE pool to avoid creating multiple EventSource connections for the same (eventId,url)
export function getOverlayStream(eventId: string, url: string, onMessage: Sub) {
  const key = `${eventId}:${url}`;
  let entry = ssePool.get(key);
  const now = Date.now();

  if (!entry || entry.connectionState === 'closed' || entry.errorCount >= MAX_ERROR_COUNT) {
    // Clean up old entry if exists
    if (entry) {
      try { entry.es.close(); } catch { }
      ssePool.delete(key);
    }

    const es = new EventSource(url, { withCredentials: true });
    entry = {
      es,
      subs: new Set<Sub>(),
      refCount: 0,
      lastActivity: now,
      connectionState: 'connecting',
      errorCount: 0,
      createdAt: now
    };

    es.onopen = () => {
      if (entry) {
        entry.connectionState = 'open';
        entry.lastActivity = Date.now();
        entry.errorCount = 0;
      }
      for (const fn of entry!.subs) fn();
    };

    es.addEventListener('hello', () => {
      if (entry) entry.lastActivity = Date.now();
      for (const fn of entry!.subs) fn();
    });

    es.addEventListener('overlay', () => {
      if (entry) entry.lastActivity = Date.now();
      for (const fn of entry!.subs) fn();
    });

    es.onerror = () => {
      if (entry) {
        entry.connectionState = 'error';
        entry.errorCount++;
        entry.lastActivity = Date.now();
      }
    };

    ssePool.set(key, entry);
  }

  entry.refCount += 1;
  entry.subs.add(onMessage);
  entry.lastActivity = now;

  return () => {
    if (entry) {
      entry.subs.delete(onMessage);
      entry.refCount -= 1;
      if (entry.refCount <= 0) {
        // Don't immediately close, let the cleanup interval handle it
        // This prevents premature closure of potentially reusable connections
      }
    }
  };
}

export function CanopyProvider({
  eventId,
  children,
  prefetchRoster = true,
  prefetchOverlays = true,
}: PropsWithChildren<{
  eventId?: string | number;
  prefetchRoster?: boolean;
  prefetchOverlays?: boolean;
}>) {
  const api = useCanopy();
  const lastPrefetchedFor = useRef<string | number | null>(null);
  const didFirstPrefetch = useRef(false);

  // One-shot prefetch on mount or when event changes
  useEffect(() => {
    let isMounted = true;

    if (eventId == null) {
      lastPrefetchedFor.current = null;
      return;
    }

    const sameEvent =
      lastPrefetchedFor.current != null &&
      String(lastPrefetchedFor.current) === String(eventId);

    if (!sameEvent || !didFirstPrefetch.current) {
      if (prefetchRoster && isMounted) void api.loadRoster(String(eventId));
      if (prefetchOverlays && isMounted) void api.getOverlaysById(String(eventId));
      lastPrefetchedFor.current = eventId;
      didFirstPrefetch.current = true;
    }

    return () => { isMounted = false; };
  }, [eventId, prefetchRoster, prefetchOverlays, api]);

  // Gentle periodic refresh (30s) — roster only when an enabled GPS/scoreboard overlay is present
  const GPS_OVERLAY_TYPES = new Set(['scoreboard', 'map', 'hud', 'card']);
  const needsRoster = React.useMemo(() => {
    if (!prefetchRoster) return false;
    const list = Array.isArray(api.overlays) ? api.overlays : [];
    return list.some((o: any) => GPS_OVERLAY_TYPES.has(String(o?.type || '')) && coerceEnabled(o?.enabled));
  }, [prefetchRoster, api.overlays]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (eventId) {
        if (prefetchOverlays) void api.getOverlaysById(String(eventId), { force: true });
        if (needsRoster) void api.loadRoster(String(eventId), { force: true });
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, [eventId, prefetchOverlays, needsRoster, api]);

  const value = useMemo<LiveStreamCtxValue>(() => ({ ...api, eventId }), [api, eventId]);
  return <LiveStreamCtx.Provider value={value}>{children}</LiveStreamCtx.Provider>;
}

export function useLiveStreamCtx(): LiveStreamCtxValue {
  const ctx = useContext(LiveStreamCtx);
  if (!ctx) throw new Error('useLiveStreamCtx() must be used within <LiveStreamProvider>');
  return ctx;
}
