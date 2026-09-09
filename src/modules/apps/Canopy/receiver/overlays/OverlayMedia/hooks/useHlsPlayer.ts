// HLS.js lifecycle hook — dynamic import, attach, error recovery, codec fallback.

import { useEffect, useRef } from 'react';
import { MAX_HLS_RECOVERY, HLS_NETWORK_RETRY_MS } from '../constants';
import { buildH264FallbackUrl } from '../utils/detection';

const safe = (fn?: () => void) => { try { fn?.(); } catch {} };

export type UseHlsPlayerArgs = {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  srcUrlRaw: string;
  isHls: boolean;
  normalizedKind: string;
  autoplay: boolean;
  isPlaying: boolean;
  onFatalError: () => void;
  onAutoplayBlocked?: () => void;
};

/**
 * Manages the full hls.js lifecycle for a single `<video>` element.
 * Handles dynamic import, manifest parsing, media/network error recovery,
 * and codec fallback to the `-h264` transcoded variant.
 */
export default function useHlsPlayer({
  videoRef,
  srcUrlRaw,
  isHls,
  normalizedKind,
  autoplay,
  isPlaying,
  onFatalError,
  onAutoplayBlocked,
}: UseHlsPlayerArgs): void {
  const hlsRef = useRef<any>(null);
  const triedCodecFallbackRef = useRef(false);

  const tryPlay = (v: HTMLVideoElement) => {
    const p = v.play();
    if (p && typeof (p as any).catch === 'function') {
      (p as any).catch((err: any) => {
        if (err && err.name === 'NotAllowedError') onAutoplayBlocked?.();
      });
    }
  };

  useEffect(() => {
    const v = videoRef.current;

    if (!v || !isHls || normalizedKind !== 'video') {
      if (hlsRef.current) {
        safe(() => hlsRef.current.destroy?.());
        hlsRef.current = null;
      }
      return;
    }

    let cancelled = false;
    // Fresh start on every (re)mount or source change so a prior stream's
    // codec-fallback state never leaks into this one.
    triedCodecFallbackRef.current = false;

    (async () => {
      try {
        const mod = await import('hls.js');
        const Hls = mod.default;

        if (!Hls || !Hls.isSupported() || cancelled) {
          // Fallback to native HLS (iOS Safari)
          if (v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
            v.src = srcUrlRaw;
            v.load();
            if (autoplay && isPlaying) {
              tryPlay(v);
            }
          } else {
            onFatalError();
          }
          return;
        }

        const hls = new Hls({
          autoStartLoad: true,
          enableWorker: true,
          // Live tuning — drop time-to-first-frame on source switches.
          lowLatencyMode: true,
          backBufferLength: 0,
          maxBufferLength: 6,
          maxMaxBufferLength: 12,
          liveSyncDurationCount: 1,
          liveMaxLatencyDurationCount: 4,
          maxLiveSyncPlaybackRate: 1.2,
          manifestLoadingTimeOut: 4000,
          manifestLoadingMaxRetry: 2,
          fragLoadingTimeOut: 6000,
          startFragPrefetch: true,
          progressive: true,
        });
        hlsRef.current = hls;

        hls.loadSource(srcUrlRaw);
        hls.attachMedia(v);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoplay && isPlaying) {
            tryPlay(v);
          }
        });

        let recoveryAttempts = 0;
        // The URL currently loaded — starts as the base path, becomes the
        // -h264 variant once we fall back. Network retries must re-fetch THIS
        // url, never bounce back to a base path we already abandoned.
        let currentUrl = srcUrlRaw;

        // Switch to the H.264 transcode variant. Returns true if it switched.
        const switchToH264Fallback = (): boolean => {
          if (triedCodecFallbackRef.current) return false;
          const fallback = buildH264FallbackUrl(srcUrlRaw);
          if (!fallback || fallback === currentUrl) return false;
          triedCodecFallbackRef.current = true;
          recoveryAttempts = 0;
          currentUrl = fallback;
          hls.loadSource(fallback);
          hls.startLoad();
          return true;
        };

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (!data?.fatal) return;

          const details: string = data.details || '';
          // A dead manifest (HEVC base path 500s) or an undecodable codec
          // (browser can't play HEVC/VP9) can't be fixed by reloading the same
          // URL — jump straight to the -h264 transcode. Note startLoad() alone
          // will NOT re-fetch a manifest that never parsed, so the old code
          // spun on the dead base URL and never reached the fallback.
          const manifestDead =
            details === 'manifestLoadError' ||
            details === 'manifestLoadTimeOut' ||
            details === 'manifestParsingError' ||
            details === 'manifestIncompatibleCodecsError';
          const undecodable =
            details === 'bufferAddCodecError' ||
            details === 'bufferIncompatibleCodecsError';

          if ((manifestDead || undecodable) && switchToH264Fallback()) return;

          // Already on the -h264 variant but it isn't ready yet (transcode
          // still spinning up → 404/500). Keep re-fetching the manifest on a
          // timer instead of giving up — this is the "black, works on refresh"
          // case. Network retries don't count toward the fallback cap.
          if (triedCodecFallbackRef.current && data.type === 'networkError') {
            setTimeout(() => {
              if (cancelled) return;
              hls.loadSource(currentUrl);
              hls.startLoad();
            }, HLS_NETWORK_RETRY_MS);
            return;
          }

          if (recoveryAttempts >= MAX_HLS_RECOVERY) {
            if (switchToH264Fallback()) return;
            onFatalError();
            return;
          }
          recoveryAttempts++;

          if (data.type === 'mediaError') {
            hls.recoverMediaError();
          } else if (data.type === 'networkError') {
            // Re-fetch the manifest (not just fragments) — the source may have
            // only just become ready.
            setTimeout(() => {
              if (cancelled) return;
              hls.loadSource(currentUrl);
              hls.startLoad();
            }, HLS_NETWORK_RETRY_MS);
          } else {
            onFatalError();
          }
        });

        hls.on(Hls.Events.MANIFEST_LOADED, () => {
          // Manifest is live again — reset the retry counter. Keep the
          // codec-fallback flag so we don't bounce back to a dead base path.
          recoveryAttempts = 0;
        });
      } catch {
        onFatalError();
      }
    })();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        safe(() => hlsRef.current.destroy?.());
        hlsRef.current = null;
      }
    };
  }, [isHls, normalizedKind, srcUrlRaw, autoplay, isPlaying, onFatalError, onAutoplayBlocked]);
}
