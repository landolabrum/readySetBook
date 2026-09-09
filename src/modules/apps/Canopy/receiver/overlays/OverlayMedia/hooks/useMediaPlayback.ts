// Playback actions — play/pause/mute/unmute/restart + prop syncing.

import { useCallback, useEffect } from 'react';
import type { OverlayMediaKind, YTFunc } from '../types';

const safe = (fn?: () => void) => { try { fn?.(); } catch {} };

export type UseMediaPlaybackArgs = {
  normalizedKind: OverlayMediaKind;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  ytId: string | null;
  isPlaying: boolean;
  muted: boolean;
};

export type UseMediaPlaybackResult = {
  play: () => void;
  pause: () => void;
  mute: () => void;
  unmute: () => void;
  restart: () => void;
};

/**
 * Provides imperative playback actions and syncs `isPlaying` / `muted`
 * props to the underlying video or iframe element.
 */
export default function useMediaPlayback({
  normalizedKind,
  iframeRef,
  videoRef,
  ytId,
  isPlaying,
  muted,
}: UseMediaPlaybackArgs): UseMediaPlaybackResult {
  const sendYT = useCallback(
    (func: YTFunc) => {
      const node = iframeRef.current;
      if (!node?.contentWindow) return;
      safe(() => node.contentWindow!.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*'));
    },
    [iframeRef],
  );

  const play = useCallback(() => {
    if (normalizedKind === 'iframe') sendYT('playVideo');
    else if (normalizedKind === 'video') safe(() => void videoRef.current?.play?.());
  }, [normalizedKind, sendYT, videoRef]);

  const pause = useCallback(() => {
    if (normalizedKind === 'iframe') sendYT('pauseVideo');
    else if (normalizedKind === 'video') safe(() => videoRef.current?.pause?.());
  }, [normalizedKind, sendYT, videoRef]);

  const doMute = useCallback(() => {
    if (normalizedKind === 'iframe') sendYT('mute');
    else if (normalizedKind === 'video' && videoRef.current) videoRef.current.muted = true;
  }, [normalizedKind, sendYT, videoRef]);

  const doUnmute = useCallback(() => {
    if (normalizedKind === 'iframe') sendYT('unMute');
    else if (normalizedKind === 'video' && videoRef.current) videoRef.current.muted = false;
  }, [normalizedKind, sendYT, videoRef]);

  const restart = useCallback(() => {
    if (normalizedKind === 'iframe') {
      sendYT('stopVideo');
      setTimeout(() => sendYT('playVideo'), 100);
      return;
    }
    if (normalizedKind === 'video' && videoRef.current) {
      safe(() => { videoRef.current!.currentTime = 0; });
      const p = videoRef.current.play?.();
      if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
    }
  }, [normalizedKind, sendYT, videoRef]);

  // Sync playing/muted props to media element on change.
  useEffect(() => {
    if (normalizedKind === 'iframe') {
      if (isPlaying) sendYT('playVideo');
      else sendYT('pauseVideo');
      if (muted) sendYT('mute');
      else sendYT('unMute');
      return;
    }

    if (normalizedKind !== 'video') return;
    const v = videoRef.current;
    if (!v) return;

    safe(() => {
      v.muted = !!muted;
      if (isPlaying) {
        const p = v.play();
        if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [normalizedKind, isPlaying, muted, sendYT, videoRef]);

  return { play, pause, mute: doMute, unmute: doUnmute, restart };
}
