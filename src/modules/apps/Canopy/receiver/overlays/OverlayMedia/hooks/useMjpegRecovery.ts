// MJPEG image-stream recovery — exponential backoff + keepalive watchdog.

import { useEffect, useRef, useState } from 'react';
import { KEEPALIVE_MS, MJPEG_BASE_INTERVAL, MJPEG_MAX_INTERVAL } from '../constants';

export type UseMjpegRecoveryArgs = {
  srcUrlRaw: string;
  isLikelyImageStream: boolean;
  normalizedKind: string;
  loadError: boolean;
  clearError: () => void;
  setImageFallbackEnabled: (v: boolean) => void;
  setKindOverride: (k: 'image') => void;
};

export type UseMjpegRecoveryResult = {
  recoveryEpoch: number;
};

/**
 * Two complementary mechanisms:
 * 1. **Error recovery** — when loadError is true, retries with exponential
 *    backoff (20 s → 120 s cap). Never gives up.
 * 2. **Keepalive watchdog** — when the stream is healthy, periodically
 *    cache-busts the `<img>` src every 2 min so Cloudflare/proxy timeouts
 *    don't silently freeze the frame.
 */
export default function useMjpegRecovery({
  srcUrlRaw,
  isLikelyImageStream,
  normalizedKind,
  loadError,
  clearError,
  setImageFallbackEnabled,
  setKindOverride,
}: UseMjpegRecoveryArgs): UseMjpegRecoveryResult {
  const recoveryCountRef = useRef(0);
  const [recoveryEpoch, setRecoveryEpoch] = useState(0);

  // Reset counters on source change.
  useEffect(() => {
    recoveryCountRef.current = 0;
    setRecoveryEpoch(0);
  }, [srcUrlRaw]);

  // ----- Error recovery (exponential backoff, never gives up) -----
  useEffect(() => {
    if (!loadError || !isLikelyImageStream) return;

    const delay = Math.min(
      MJPEG_BASE_INTERVAL * Math.pow(2, Math.min(recoveryCountRef.current, 10)),
      MJPEG_MAX_INTERVAL,
    );

    const timer = setTimeout(() => {
      recoveryCountRef.current++;
      setRecoveryEpoch(prev => prev + 1);
      setImageFallbackEnabled(true);
      setKindOverride('image');
      clearError();
    }, delay);

    return () => clearTimeout(timer);
  }, [loadError, isLikelyImageStream, clearError, setImageFallbackEnabled, setKindOverride]);

  // ----- Keepalive watchdog (healthy streams) -----
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (keepaliveRef.current) {
      clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }

    if (!isLikelyImageStream || normalizedKind !== 'image' || loadError) return;

    keepaliveRef.current = setInterval(() => {
      setRecoveryEpoch(prev => prev + 1);
      recoveryCountRef.current = 0; // reset backoff for next error cycle
    }, KEEPALIVE_MS);

    return () => {
      if (keepaliveRef.current) {
        clearInterval(keepaliveRef.current);
        keepaliveRef.current = null;
      }
    };
  }, [isLikelyImageStream, normalizedKind, loadError]);

  return { recoveryEpoch };
}
