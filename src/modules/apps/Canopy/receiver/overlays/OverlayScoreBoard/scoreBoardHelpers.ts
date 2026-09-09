
import { MutableRefObject, useEffect, useRef, useState, useLayoutEffect } from 'react';

/* ================================
 * Types + small utilities
 * ================================ */

export const rowKey = (t: any, i: number) => String(t?.id ?? t?.name ?? i);

export const rankLabel = (p?: number) =>
  p == null
    ? '—'
    : p === 1
    ? '1st (Gold)'
    : p === 2
    ? '2nd (Silver)'
    : p === 3
    ? '3rd (Bronze)'
    : `${p}`;

export function normalizeTitle(
  input: any,
  fallback = 'no live'
): { text?: string; img?: string; alt?: string; width: number; height: number } {
  if (typeof input === 'string' || !input) {
    const text = typeof input === 'string' ? input : fallback;
    return {
      text,
      img: undefined,
      alt: 'Sponsor',
      width: 170,
      height: 70,
    };
  }
  return {
    text: input.text ?? fallback,
    img: input.img,
    alt: input.alt ?? (typeof input.text === 'string' ? input.text : 'Sponsor'),
    width: input.width ?? 170,
    height: input.height ?? 70,
  };
}

export const getText = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v.trim() || undefined;
  if (
    v &&
    typeof v === 'object' &&
    'text' in (v as any) &&
    typeof (v as any).text === 'string'
  ) {
    const t = (v as any).text.trim();
    return t || undefined;
  }
  return undefined;
};

/** Stable sort by place, then previous visual order */
export function stableOrder<T>(
  arr: T[],
  getRank: (t: T) => number | undefined,
  prevOrder: Map<string, number>,
  getKey: (t: T, i: number) => string
) {
  const withIdx = arr.map((t, i) => ({ t, i, k: getKey(t, i) }));
  withIdx.sort((a, b) => {
    const ra = getRank(a.t);
    const rb = getRank(b.t);
    const aa = ra == null ? Number.POSITIVE_INFINITY : ra;
    const bb = rb == null ? Number.POSITIVE_INFINITY : rb;
    if (aa !== bb) return aa - bb;
    const pa = prevOrder.get(a.k) ?? a.i;
    const pb = prevOrder.get(b.k) ?? b.i;
    return pa - pb;
  });
  return withIdx.map((x) => x.t);
}

/* ================================
 * Intro timing (exact ~5s sequence)
 * ================================ */

export function computeIntroTiming(
  rowCount: number,
  totalMs = 5000,
  maxRows = 6
) {
  const n = Math.max(1, Math.min(maxRows, rowCount || 1));
  const headerMs = 900; // header fade in
  const rowMs = 600; // each row anim duration
  const baseDelay = 400; // wait after header before first row
  const stagger =
    Math.max(90, Math.round((totalMs - headerMs - rowMs - baseDelay) / Math.max(n - 1, 1))) ||
    90;
  const total = headerMs + baseDelay + (n - 1) * stagger + rowMs;
  return { n, headerMs, rowMs, baseDelay, stagger, total };
}

/* ================================
 * Mount-ready after fonts + 2x rAF
 * ================================ */

export function useMountReady() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // @ts-ignore
        if (document?.fonts?.ready) await (document as any).fonts.ready;
      } catch {}
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      );
      if (!cancelled) setMounted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return mounted;
}

/* ================================
 * One-shot intro (JS / WAAPI)
 * ================================ */

type IntroRow = { key: string; el?: HTMLElement | null; idx: number; color?: string };
export function run5sIntro(opts: {
  headerEl?: HTMLElement | null;
  rows: IntroRow[];
  intro: { headerMs: number; rowMs: number; baseDelay: number; stagger: number; total: number };
  onEnd?: () => void;
}) {
  const { headerEl, rows, intro, onEnd } = opts;

  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const headerAnims: Animation[] = [];
  const rowAnims: Animation[] = [];

  if (!reduce && headerEl) {
    headerAnims.push(
      headerEl.animate(
        [
          { opacity: 0, transform: 'translateY(-10px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          duration: intro.headerMs,
          easing: 'cubic-bezier(.22,.61,.36,1)',
          fill: 'both',
        }
      )
    );
  }

  if (!reduce) {
    for (const r of rows) {
      if (!r.el) continue;
      const delay = intro.baseDelay + r.idx * intro.stagger;
      const a = r.el.animate(
        [
          { opacity: 0, transform: 'translateY(-12px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          duration: intro.rowMs,
          delay,
          easing: 'cubic-bezier(.22,.61,.36,1)',
          fill: 'forwards',
        }
      );
      rowAnims.push(a);
    }
  }

  const doneTimer = window.setTimeout(() => onEnd?.(), intro.total + 40);

  return () => {
    try {
      headerAnims.forEach((a) => a.cancel());
      rowAnims.forEach((a) => a.cancel());
    } catch {}
    window.clearTimeout(doneTimer);
  };
}

/* ================================
 * FLIP reorder
 * ================================ */

export function useFlipReorder(opts: {
  enabled: boolean;
  rows: { key: string; el: HTMLElement | null }[];
  prevIndexRef: MutableRefObject<Map<string, number>>;
  onStart?: () => void;
  onEnd?: () => void;
}) {
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const animCountRef = useRef(0);

  useLayoutEffectLike(() => {
    if (!opts.enabled) {
      // still refresh rects so we can start FLIP after intro
      const m = new Map<string, DOMRect>();
      const idx = new Map<string, number>();
      opts.rows.forEach((r, i) => {
        if (r.el) {
          m.set(r.key, r.el.getBoundingClientRect());
          idx.set(r.key, i);
        }
      });
      prevRects.current = m;
      opts.prevIndexRef.current = idx;
      return;
    }

    const newRects = new Map<string, DOMRect>();
    const newIndex = new Map<string, number>();
    opts.rows.forEach((r, i) => {
      if (r.el) {
        newRects.set(r.key, r.el.getBoundingClientRect());
        newIndex.set(r.key, i);
      }
    });

    // Build a movement map so we can treat the primary moved row differently
    const movements: Array<{ key: string; from: number; to: number; delta: number; movedUp: boolean }> = [];
    opts.rows.forEach((r, i) => {
      const fromIdx = opts.prevIndexRef.current.get(r.key);
      const toIdx = i;
      if (fromIdx != null && fromIdx !== toIdx) {
        movements.push({ key: r.key, from: fromIdx, to: toIdx, delta: Math.abs(fromIdx - toIdx), movedUp: fromIdx > toIdx });
      }
    });

    let anyAnimated = false;
    opts.rows.forEach((r, i) => {
      const node = r.el;
      if (!node) return;
      // Cancel any existing animations on the row
      node.getAnimations().forEach((a) => a.cancel());

      const from = prevRects.current.get(r.key);
      const to = newRects.get(r.key);
      if (!from || !to) return;

      let dx = from.left - to.left;
      let dy = from.top - to.top;

      // If the browser reports 0 delta but the index changed, synthesize a delta
      // based on row height so the motion always plays in the correct direction.
      if (!dx && !dy) {
        const oldIdx = opts.prevIndexRef.current.get(r.key);
        if (oldIdx != null && oldIdx !== i) {
          const rowH = Math.max(1, to.height);
          const deltaIdx = oldIdx - i; // positive when moving up
          dy = deltaIdx * rowH; // positive dy offsets downwards, animates upward to 0
        } else {
          return;
        }
      }

      const oldIdx = opts.prevIndexRef.current.get(r.key) ?? i;
      const movedUp = oldIdx > i;
      const movedDown = oldIdx < i;
      const scaleTo = movedUp ? 1.08 : movedDown ? 0.985 : 1;

      // Table rows (<tr>) don't always render transform animations reliably.
      // Animate the row's cell children when the node is a TR.
      const targets: HTMLElement[] =
        String((node as HTMLElement).tagName).toUpperCase() === 'TR'
          ? (Array.from(node.children) as HTMLElement[])
          : [node as HTMLElement];

      // Determine the primary moved row: prefer the row that moved up the most (overtake),
      // otherwise the one with the largest absolute movement.
      const primary = (() => {
        if (movements.length === 0) return undefined;
        const ups = movements.filter((m) => m.movedUp);
        const pool = ups.length ? ups : movements;
        return pool.reduce((best, m) => (!best || m.delta > best.delta ? m : best), undefined as any);
      })();
      const primaryKey = primary?.key as string | undefined;
      const isPrimaryMove = primaryKey === r.key;
      const affectedDown = movements.some((m) => m.from > m.to && i >= m.to && i < m.from && m.key !== r.key);
      const affectedUp = movements.some((m) => m.from < m.to && i <= m.to && i > m.from && m.key !== r.key);

      targets.forEach((t) => {
        t.getAnimations().forEach((a) => a.cancel());
        // Elevate the primary moved row so it appears above others while moving
        if (isPrimaryMove) {
          const prevPos = t.style.position;
          const prevZ = t.style.zIndex;
          t.style.position = 'relative';
          t.style.zIndex = '3';
          const a = t.animate(
            [
              {
                transform: `translate(${dx}px, ${dy}px) scale(${Math.max(1.0, scaleTo + 0.06)})`,
                filter: movedUp
                  ? 'saturate(1.18)'
                  : movedDown
                  ? 'saturate(0.98)'
                  : 'none',
                boxShadow: '0 14px 32px rgba(0,0,0,.42)',
              },
              {
                transform: 'translate(0, -3px) scale(1.02)',
                boxShadow: '0 8px 18px rgba(0,0,0,.30)',
                offset: 0.7,
              },
              {
                transform: 'translate(0, 0) scale(1)',
                filter: 'none',
                boxShadow: 'none',
              },
            ],
            { duration: 760, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
          );
          anyAnimated = true;
          animCountRef.current += 1;
          const done = () => {
            t.style.position = prevPos;
            t.style.zIndex = prevZ;
            animCountRef.current -= 1;
            if (animCountRef.current <= 0) opts.onEnd?.();
          }
          a.onfinish = done;
          a.oncancel = done;
        } else {
          // Affected neighbors get a subtle nudge in the opposite sense
          const subtleScale = affectedDown ? 0.995 : affectedUp ? 1.005 : 1;
          t.animate(
            [
              {
                transform: `translate(${dx}px, ${dy}px) scale(${subtleScale})`,
                filter: (affectedDown || affectedUp) ? 'brightness(0.98)' : 'none',
              },
              {
                transform: 'translate(0, 0) scale(1)',
                filter: 'none',
              },
            ],
            { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' }
          );
          anyAnimated = true;
        }
      });
    });

    if (anyAnimated) opts.onStart?.();
    prevRects.current = newRects;
    opts.prevIndexRef.current = newIndex;
  }, [opts.enabled, JSON.stringify(opts.rows.map((r) => r.key))]);
}

/* ================================
 * Score bump (tiny CSS hook)
 * ================================ */

export function useScoreBumpEffect(opts: {
  rows: { key: string; el: HTMLElement | null; score?: number; place?: number }[];
}) {
  // Track a signature of values that should trigger a bump (score or place changes)
  const prevSig = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    for (const r of opts.rows) {
      const sig = JSON.stringify({ s: r.score ?? null, p: r.place ?? null });
      const prev = prevSig.current.get(r.key);
      if (prev != null && prev !== sig) {
        if (r.el) {
          const cell =
            (r.el.querySelector('.scoreboard__cell--id') as HTMLElement | null) ||
            (r.el.querySelector('.scoreboard__cell--score') as HTMLElement | null);
          if (cell) {
            cell.classList.remove('is-score-bump');
            // force reflow to restart the animation
            // @ts-ignore
            (cell as any).offsetWidth;
            cell.classList.add('is-score-bump');
          }
        }
      }
      prevSig.current.set(r.key, sig);
    }
  }, [JSON.stringify(opts.rows.map((r) => ({ k: r.key, s: r.score, p: r.place })) )]);
}

/* ================================
 * Leader flash (when leader changes)
 * ================================ */

export function useLeaderFlashEffect(opts: {
  enabled: boolean;
  leaderKey?: string;
  getNode: (k: string) => HTMLElement | null;
}) {
  const prevLeader = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!opts.enabled || !opts.leaderKey) return;
    if (opts.leaderKey !== prevLeader.current) {
      const node = opts.getNode(opts.leaderKey);
      if (node) {
        node.classList.add('is-leader-flash');
        node.addEventListener(
          'animationend',
          () => node.classList.remove('is-leader-flash'),
          { once: true }
        );
      }
      prevLeader.current = opts.leaderKey;
    }
  }, [opts.enabled, opts.leaderKey, opts.getNode]);
}

/* ================================
 * Internal: layout effect on SSR/CSR
 * ================================ */

function useLayoutEffectLike(effect: any, deps: any[]) {
  // SSR-safe: use layout effect on client for smoother FLIP; effect on server
  const hook = typeof window === 'undefined' ? (useEffect as any) : (useLayoutEffect as any);
  hook(effect, deps);
}
