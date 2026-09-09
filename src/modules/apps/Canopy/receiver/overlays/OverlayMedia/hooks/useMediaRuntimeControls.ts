// Runtime controls — BroadcastChannel + CustomEvent listeners.

import { useCallback, useEffect } from 'react';

const safe = (fn?: () => void) => { try { fn?.(); } catch {} };

type Action = 'play' | 'pause' | 'mute' | 'unmute' | 'restart';

export type UseMediaRuntimeControlsArgs = {
  overlayId?: string | number;
  play: () => void;
  pause: () => void;
  mute: () => void;
  unmute: () => void;
  restart: () => void;
};

/**
 * Listens on `BroadcastChannel('canopy-media-control')` and
 * `window 'canopy:media-control'` CustomEvent for runtime commands.
 * Commands can target a specific overlayId or broadcast to all.
 */
export default function useMediaRuntimeControls({
  overlayId,
  play,
  pause,
  mute,
  unmute,
  restart,
}: UseMediaRuntimeControlsArgs): void {
  const dispatch = useCallback(
    (action: Action) => {
      if (action === 'play') play();
      else if (action === 'pause') pause();
      else if (action === 'mute') mute();
      else if (action === 'unmute') unmute();
      else if (action === 'restart') restart();
    },
    [play, pause, mute, unmute, restart],
  );

  // BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supportsBC = typeof (window as any).BroadcastChannel !== 'undefined';
    if (!supportsBC) return;

    const ch = new BroadcastChannel('canopy-media-control');
    const handler = (ev: MessageEvent<any>) => {
      const payload = ev?.data || {};
      const target = payload?.overlayId;
      if (target != null && overlayId != null && String(target) !== String(overlayId)) return;
      const action = String(payload?.action || '').toLowerCase() as Action;
      dispatch(action);
    };

    ch.addEventListener('message', handler);
    return () => {
      safe(() => {
        ch.removeEventListener('message', handler);
        ch.close();
      });
    };
  }, [overlayId, dispatch]);

  // Window CustomEvent
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail || {};
        const target = detail?.overlayId;
        if (target != null && overlayId != null && String(target) !== String(overlayId)) return;
        const action = String(detail.action || '').toLowerCase() as Action;
        dispatch(action);
      } catch {}
    };

    window.addEventListener('canopy:media-control', handler as any);
    return () => window.removeEventListener('canopy:media-control', handler as any);
  }, [overlayId, dispatch]);
}
