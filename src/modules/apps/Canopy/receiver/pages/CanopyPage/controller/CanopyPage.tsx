

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './CanopyPage.scss';
import CanopyMedia from '../../../components/CanopyMedia/controller/CanopyMedia';
import { CanopyProvider, useLiveStreamCtx } from '@Canopy/context/CanopyProvider';
import { useCinemaLayout } from '@Canopy/hooks/useCinemaLayout';
import type { EventRow as EvRow, RosterRow } from '@Canopy/hooks/useCanopy';
import { getService } from '@webstack/common';
import IDataBaseService from '~/src/core/services/DataBaseService/IDataBaseService';
import { useHeader } from '@webstack/components/Containers/Header/controller/MainHeader';
import { useRouter } from 'next/router';

type Props = {
  fullscreen?: boolean;
  eventId?: string | number;
  onResolvedEventId?: (id: string | number | null) => void;
};

const toNumOrUndef = (val: unknown): number | undefined => {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

const sortRosterStable = (list: RosterRow[]) => {
  return [...list].sort((a, b) => {
    const as = toNumOrUndef((a as any).place) ?? toNumOrUndef(a.score) ?? 0;
    const bs = toNumOrUndef((b as any).place) ?? toNumOrUndef(b.score) ?? 0;
    return as - bs;
  });
};

/* ================= inner (uses context) ================= */
const OverlayPageInner: React.FC<
  Required<Pick<Props, 'fullscreen'>> & {
    initialEventId?: string | number;
    onResolvedEventId?: (id: string | number | null) => void;
  }
> = ({ fullscreen, initialEventId, onResolvedEventId }) => {
  const { events, loadEvents, roster, loadRoster } = useLiveStreamCtx();
  const [targetEvent, setTargetEvent] = useState<EvRow | null>(null);
  const [noLive, setNoLive] = useState(false);
  const [pinnedNotLive, setPinnedNotLive] = useState(false);

  const resolvePreferredEvent = useCallback(async (): Promise<{ ev: EvRow | null; hadLive: boolean }> => {
    try {
      // Always fetch latest events from DB so /live reflects real-time changes
      const db = getService<IDataBaseService>('IDataBaseService');
      let list: EvRow[] = [];
      try {
        const res = await db.selectData({ tableName: 'livestream_event' });
        list = (res?.data ?? []) as EvRow[];
      } catch {
        // Fallback to context cache if DB fetch fails
        await loadEvents();
        list = (events ?? []) as EvRow[];
      }
      if (!list.length) return { ev: null, hadLive: false };

      const live = list.filter((e) => !!e.is_live);
      const hadLive = live.length > 0;
      if (!hadLive) return { ev: null, hadLive: false };

      live.sort((a, b) => {
        const as = new Date(a.starts_at ?? 0).getTime();
        const bs = new Date(b.starts_at ?? 0).getTime();
        if (as !== bs) return bs - as;
        return Number(b.id) - Number(a.id);
      });
      return { ev: live[0] ?? null, hadLive: true };
    } catch {
      return { ev: null, hadLive: false };
    }
  }, [events, loadEvents]);

  // initial target event resolve
  useEffect(() => {
    let alive = true;
    (async () => {
      if (initialEventId != null) {
        // Start with a stub so the UI renders immediately
        let ev = { id: String(initialEventId), name: '' } as unknown as EvRow;
        if (!alive) return;
        setNoLive(false);

        // Fetch the full event row so design_width/design_height are available
        try {
          const db = getService<IDataBaseService>('IDataBaseService');
          const res = await db.selectData({ tableName: 'livestream_event' });
          const list = (res?.data ?? []) as EvRow[];
          const fullRow = list.find(e => String(e.id) === String(initialEventId));
          if (fullRow) ev = fullRow;
          const live = list.find(e => !!e.is_live);
          setPinnedNotLive(!live || String(live.id) !== String(ev.id));
        } catch {
          // fallback via resolvePreferredEvent
          const { ev: live, hadLive } = await resolvePreferredEvent();
          setPinnedNotLive(!(hadLive && live && String(live.id) === String(ev.id)));
        }

        if (!alive) return;
        setTargetEvent(ev);
        onResolvedEventId?.(ev.id as any);
        await Promise.all([loadRoster(String(ev.id))]);
        return;
      }

      const { ev, hadLive } = await resolvePreferredEvent();
      if (!alive) return;

      // If nothing is live at this instant, do not clear any previously
      // selected target; just mark the state as noLive and keep trying.
      if (!hadLive || !ev) {
        setNoLive(true);
        return;
      }

      setNoLive(false);
      setTargetEvent(ev);
      onResolvedEventId?.(ev.id as any);
      await Promise.all([loadRoster(String(ev.id))]);
    })();

    return () => { alive = false; };
  }, [initialEventId, resolvePreferredEvent, loadRoster, onResolvedEventId]);

  // When pinned to a specific event id, update the badge state periodically
  useEffect(() => {
    if (initialEventId == null) return;
    let cancelled = false;
    // Periodically refresh roster for pinned events so /live reflects live-time changes
    const refreshRoster = async () => {
      try {
        if (cancelled) return;
        await loadRoster(String(initialEventId), { force: true });
      } catch {
        /* best-effort */
      }
    };

    const check = async () => {
      const { ev: live, hadLive } = await resolvePreferredEvent();
      if (cancelled) return;
      const pinnedId = String(initialEventId);
      setPinnedNotLive(!(hadLive && live && String(live.id) === pinnedId));
    };
    void check();
    const id = window.setInterval(async () => { await check(); await refreshRoster(); }, 15_000);
    const onVis = () => { if (!document.hidden) void check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [initialEventId, resolvePreferredEvent]);

  const [header, setHeader] = useHeader();

  // auto-follow the currently-live event when eventId is not pinned
  useEffect(() => {
    if (initialEventId != null) return;
    setHeader({ hideNavbar: true });

    let cancelled = false;

    const tick = async () => {
      const { ev, hadLive } = await resolvePreferredEvent();
      if (cancelled) return;

      const nextId = ev?.id ? String(ev.id) : null;
      const currId = targetEvent?.id ? String(targetEvent.id) : null;

      if (hadLive && nextId && nextId !== currId) {
        setNoLive(false);
        setTargetEvent(ev!);
        onResolvedEventId?.(nextId as any);
        await Promise.all([loadRoster(nextId, { force: true })]);
      }
      // If nothing is live, keep rendering the previous targetEvent (do not clear).
      if (!hadLive) {
        setNoLive(true);
      }
    };

    void tick();
    const id = window.setInterval(tick, 15_000);
    const onVis = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [initialEventId, targetEvent, resolvePreferredEvent, loadRoster, onResolvedEventId, setHeader]);

  /* ---------- derived teams ---------- */
  const teams = useMemo(() => {
    const list = Array.isArray(roster) ? sortRosterStable(roster) : [];
    return list.map((r, i) => {
      const vehicle = (r as any).vehicle_number != null ? String((r as any).vehicle_number) : (r as any).number != null ? String((r as any).number) : undefined;
      const idStr = (r as any).id != null ? String((r as any).id) : undefined;
      return {
        // Show table id in the scoreboard's ID column; keep vehicle_number separately
        id: idStr, // only actual table id
        vehicle_number: vehicle,
        name: (r as any).team_name,
        competitor: Array.isArray((r as any)?.competitors) ? (r as any).competitors[0]?.name ?? undefined : (r as any).competitor_name ?? undefined,
        // Pass competitors[] through so fullscreen variant can render role:name line
        competitors: Array.isArray((r as any)?.competitors)
          ? (r as any).competitors.map((c: any) => ({
            id: c?.id,
            name: c?.name ?? null,
            role: c?.role ?? null,
            position: typeof c?.position === 'number' ? c.position : (c?.position != null ? Number(c.position) : null),
          }))
          : undefined,
        color: typeof (r as any).color === 'string' ? (r as any).color : undefined,
        place: (r as any).place != null ? Number((r as any).place) : i + 1,
        score: toNumOrUndef((r as any).score),
      } as any;
    });
  }, [roster]);

  const cls = `canopy-page ${fullscreen ? 'is-fullscreen' : 'is-inline'}`;

  // Never show the global "Nothing is live" placeholder; keep previous overlays visible.
  const router = useRouter();
  const { width: queryWidth, height: queryHeight } = router.query;
  return (
    <>
      <style jsx>{styles}</style>
      <div className={cls}>
        {initialEventId != null && pinnedNotLive && (<></>
          // <div className="canopy-page__badge" aria-live="polite"></div>
          // SCENARIO 1 QR
        )}

        {targetEvent?.id && (
          <CanopyMedia
            fullScreen={fullscreen}
            source="server"
            useSSE
            pollMs={0}
            eventId={String(targetEvent.id)}
            designWidth={(queryWidth && Number(queryWidth) || targetEvent.design_width) ?? undefined}
            designHeight={(queryHeight && Number(queryHeight) || targetEvent.design_height) ?? undefined}
            teamsOverride={teams}
            suppressEmptyPlaceholder
          />
        )}
      </div>
    </>
  );
};

/* ================= exported page (wraps with Provider) ================= */
const CanopyPage: React.FC<Props> = ({ fullscreen = true, eventId, onResolvedEventId }) => {
  // Apply cinema layout (background + hide navbar handled above as well)
  // FORWARD QUERY webapp/src/pages/live/index.tsx
  // const [hasOpenedVdo, setHasOpenedVdo] = useState(false);

  // const maybeOpenVdo = useCallback(() => {
  //   if (hasOpenedVdo) return;
  //   if (typeof window === 'undefined') return;

  //   const { vdo } = router.query || {};
  //   if (!vdo) return;

  //   const isDesktop = window.innerWidth >= 1024;
  //   if (!isDesktop) return;

  //   setHasOpenedVdo(true);

  //   const vdoUrl = typeof vdo === 'string' && vdo.length > 0 ? vdo : 'https://vdo.ninja/whip#twitch';

  //   const screenW = window.screen?.availWidth || window.innerWidth;
  //   const screenH = window.screen?.availHeight || window.innerHeight;
  //   const width = Math.min(800, Math.floor(screenW * 0.5));
  //   const height = Math.min(800, screenH);
  //   const left = Math.max(0, screenW - width);
  //   const top = 0;

  //   window.open(
  //     vdoUrl,
  //     'canopy_vdo_ninja_live',
  //     `width=${width},height=${height},left=${left},top=${top}`
  //   );
  // }, [hasOpenedVdo, router]);

  // useEffect(() => { maybeOpenVdo(); }, [maybeOpenVdo]);
  useCinemaLayout();
  return (
    <CanopyProvider eventId={eventId} prefetchRoster prefetchOverlays>
      <OverlayPageInner
        fullscreen={fullscreen}
        initialEventId={eventId}
        onResolvedEventId={onResolvedEventId}
      />
    </CanopyProvider>
  );
};

export default CanopyPage;
