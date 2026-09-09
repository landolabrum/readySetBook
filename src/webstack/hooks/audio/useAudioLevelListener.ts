import { useEffect, useRef, useState, useCallback } from 'react';

const CHANNEL_NAME = 'canopy-media-control';
const STALE_MS = 2000;

export type OverlayLevels = Map<string, number>;

export function useAudioLevelListener() {
  const rawRef = useRef<Map<string, { level: number; ts: number }>>(new Map());
  const [peakLevel, setPeakLevel] = useState(0);
  const [overlayLevels, setOverlayLevels] = useState<OverlayLevels>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;
    const ch = new BroadcastChannel(CHANNEL_NAME);

    ch.onmessage = (ev) => {
      const { action, overlayId, level } = ev.data ?? {};
      if (action !== 'audio-level' || typeof level !== 'number') return;
      rawRef.current.set(overlayId, { level, ts: Date.now() });

      const now = Date.now();
      let peak = 0;
      const next = new Map<string, number>();
      rawRef.current.forEach((entry, key) => {
        if (now - entry.ts > STALE_MS) {
          rawRef.current.delete(key);
        } else {
          next.set(key, entry.level);
          if (entry.level > peak) peak = entry.level;
        }
      });
      setPeakLevel(peak);
      setOverlayLevels(next);
    };

    return () => { try { ch.close(); } catch {} };
  }, []);

  return { peakLevel, overlayLevels };
}
