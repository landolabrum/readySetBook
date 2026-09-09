// Iframe autoplay kick + load watchdog (OBS browser source compatible).

import { useCallback, useEffect, useRef } from 'react';
import type { YTFunc } from '../types';
import { IFRAME_LOAD_TIMEOUT } from '../constants';

const safe = (fn?: () => void) => { try { fn?.(); } catch {} };

export type UseIframeAutoplayArgs = {
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  normalizedKind: string;
  autoplay: boolean;
  isPlaying: boolean;
  ytId: string | null;
  clearError: () => void;
  onLoadTimeout: () => void;
};

export type UseIframeAutoplayResult = {
  onIframeLoad: () => void;
};

/**
 * Handles iframe autoplay kicking including YouTube postMessage API
 * and generic iframe messaging. Sets up a load timeout watchdog and
 * user-interaction listeners for OBS browser source compatibility.
 */
export default function useIframeAutoplay({
  iframeRef,
  normalizedKind,
  autoplay,
  isPlaying,
  ytId,
  clearError,
  onLoadTimeout,
}: UseIframeAutoplayArgs): UseIframeAutoplayResult {
  const iframeLoadedRef = useRef(false);

  const sendYT = useCallback(
    (func: YTFunc) => {
      const node = iframeRef.current;
      if (!node?.contentWindow) return;
      safe(() => node.contentWindow!.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*'));
    },
    [iframeRef],
  );

  const attemptPlay = useCallback(() => {
    if (!autoplay || !isPlaying) return;

    if (ytId) {
      sendYT('playVideo');
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    safe(() => {
      iframe.contentWindow!.postMessage({ action: 'play' }, '*');
      iframe.contentWindow!.postMessage({ event: 'play' }, '*');
      iframe.contentWindow!.postMessage('play', '*');
      iframe.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
    });
  }, [autoplay, isPlaying, ytId, sendYT, iframeRef]);

  const onIframeLoad = useCallback(() => {
    iframeLoadedRef.current = true;
    clearError();
    if (normalizedKind !== 'iframe') return;
    setTimeout(attemptPlay, 900);
    setTimeout(attemptPlay, 1400);
    setTimeout(attemptPlay, 2000);
  }, [normalizedKind, attemptPlay, clearError]);

  // Load timeout watchdog
  useEffect(() => {
    if (normalizedKind !== 'iframe') return;
    iframeLoadedRef.current = false;
    const t = setTimeout(() => {
      if (!iframeLoadedRef.current) onLoadTimeout();
    }, IFRAME_LOAD_TIMEOUT);
    return () => clearTimeout(t);
  }, [normalizedKind, onLoadTimeout]);

  // OBS: user-interaction autoplay kick
  useEffect(() => {
    if (normalizedKind !== 'iframe' || !autoplay || !isPlaying) return;

    const onInteract = () => {
      if (!iframeLoadedRef.current) return;
      attemptPlay();
    };

    window.addEventListener('click', onInteract, { once: true, capture: true });
    window.addEventListener('touchstart', onInteract, { once: true, capture: true });
    window.addEventListener('keydown', onInteract, { once: true, capture: true });
    window.addEventListener('focus', onInteract, { once: true });

    return () => {
      window.removeEventListener('click', onInteract, true);
      window.removeEventListener('touchstart', onInteract, true);
      window.removeEventListener('keydown', onInteract, true);
      window.removeEventListener('focus', onInteract);
    };
  }, [normalizedKind, autoplay, isPlaying, attemptPlay]);

  return { onIframeLoad };
}
