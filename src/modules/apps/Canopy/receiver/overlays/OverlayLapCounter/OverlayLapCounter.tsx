// Relative Path: ./OverlayLapCounter.tsx
import React, { useMemo, useEffect, useState, useRef, useLayoutEffect } from 'react';
import styles from './OverlayLapCounter.scss';
/* Theme merged locally into component stylesheet */
import UiMarkdown from '@webstack/components/UiMarkDown/controller/UiMarkDown';

type OverlayLike = {
  id?: string;
  type?: string;
  title?: string | null;
  description?: string | null;
  data?: {
    currentLap?: number | null;
    totalLaps?: number | null;
    [key: string]: any;
  } | null;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const OverlayLapCounter: React.FC<{ current?: OverlayLike }> = ({ current }) => {
  const { label, desc, cur, tot, pct } = useMemo(() => {
    const rawCur = Number((current?.data as any)?.currentLap ?? 1);
    const rawTot = (current?.data as any)?.totalLaps;
    const cur = Number.isFinite(rawCur) ? clamp(rawCur, 0, 999) : 1;
    const tot = typeof rawTot === 'number' && Number.isFinite(rawTot) ? clamp(rawTot, 0, 999) : null;
    const pct = tot && tot > 0 ? clamp((cur / tot) * 100, 0, 100) : null;
    const label = (current?.title ?? 'Lap') as string;
    const desc = (current?.description ?? '') as string;
    return { label, desc, cur, tot, pct } as const;
  }, [current?.title, current?.description, current?.data]);

  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setIntro(false), 900);
    return () => window.clearTimeout(id);
  }, []);

  // Dynamically size the total so its rendered width matches the current digit width
  const curRef = useRef<HTMLSpanElement | null>(null);
  const totRef = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const curEl = curRef.current;
    const totEl = totRef.current;
    if (!curEl || !totEl) {
      return;
    }
    // Reset any previous transform before measuring
    totEl.style.transform = '';
    const curW = curEl.getBoundingClientRect().width;
    const totW = totEl.getBoundingClientRect().width;
    if (curW > 0 && totW > 0) {
      const scale = curW / totW;
      const clamped = Math.max(0.5, Math.min(2.75, scale));
      totEl.style.transformOrigin = 'left center';
      totEl.style.transform = `scale(${clamped})`;
    }
  }, [cur, tot, label]);

  return (
    <>

      <style jsx>{styles}</style>
      <div className="overlay-lap-counter" data-intro={intro ? 'true' : 'false'} role="status" aria-live="polite">
        <div className="overlay-lap-counter__header" title={String(label)}>
          <span className="overlay-lap-counter__header-title">
            <UiMarkdown text={label || 'Lap'} />
          </span>
          {desc && (
            <span className="overlay-lap-counter__header-desc">
              <UiMarkdown text={desc} />
            </span>
          )}
        </div>
        <div className="overlay-lap-counter__digits" data-number>
          <div className='overlay-lap-counter__digits--content'>
            <span ref={curRef} className="overlay-lap-counter__current" aria-label={`Current lap ${cur}`}>{cur}</span>
            {typeof tot === 'number' && tot > 0 && (
              <>

                <span ref={totRef} className="overlay-lap-counter__total" aria-label={`Total laps ${tot}`}>{tot}</span>
              </>
            )}
          </div>
        </div>
        {/* {pct != null && (
          <div className="overlay-lap-counter__progress" aria-hidden="true">
            <div className="overlay-lap-counter__bar" style={{ width: `${pct}%` }} />
          </div>
        )} */}
      </div>
    </>
  );
};

export default OverlayLapCounter;
