// useShareStream — playback lifecycle for a share-family overlay
// (screen/camera/encoder/pull). Handles MediaStream attach + HLS.js, with a
// reactive `-h264` codec fallback as belt-and-suspenders.
//
// State machine:
//   resolved.kind === 'stream'  → attach MediaStream to <video>
//   resolved.kind === 'hls'     → mount hls.js (or native HLS on Safari)
//   resolved.kind === 'waiting' → render placeholder; await SSE update
//   resolved.kind === 'ended'   → idle; caller renders chrome.
//
// The backend is authoritative for `data.src` — once MediaMTX detects the
// correct codec variant, the pipeline route patches the overlay row directly
// and SSE fans it out. No client-side status polling needed; this hook is
// purely reactive to `resolved.src` updates.
//
// Codec resilience: if `resolved.src` arrives before the backend has stamped
// the canonical URL (race during the first second of a new session), the
// reactive fallback below swaps to the `-h264` variant on fatal hls.js error,
// native <video> error, or a stuck-on-connecting watchdog.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResolvedShareSource } from '@Canopy/lib/share/resolveShareSource';

export type ShareStreamState = 'idle' | 'connecting' | 'playing' | 'autoplay-blocked' | 'error';

export type UseShareStreamArgs = {
    videoRef: React.MutableRefObject<HTMLVideoElement | null>;
    resolved: ResolvedShareSource;
    autoplay: boolean;
    muted: boolean;
    playing: boolean;
    volume: number;
};

export type UseShareStreamResult = {
    state: ShareStreamState;
    enableSound: () => void;
};

const MAX_HLS_RECOVERY = 3;
const HLS_NETWORK_RETRY_MS = 3_000;
const STUCK_WATCHDOG_MS = 8_000;
const LONG_RETRY_MS = 20_000;

const safe = (fn?: () => void) => { try { fn?.(); } catch { /* noop */ } };

/** Build the `-h264` MediaMTX transcode variant for an HLS URL.
 *  Returns null when the URL doesn't match the expected shape or is already `-h264`. */
const buildH264Fallback = (url: string): string | null => {
    if (!url || url.includes('-h264/')) return null;
    const m = url.match(/^(.*\/)([^/]+)(\/index\.m3u8.*)$/i);
    if (m) return `${m[1]}${m[2]}-h264${m[3]}`;
    const m2 = url.match(/^(.*\/)([^/]+)(\.m3u8.*)$/i);
    if (m2) return `${m2[1]}${m2[2]}-h264${m2[3]}`;
    return null;
};

const tryPlay = (v: HTMLVideoElement, set: (s: ShareStreamState) => void) => {
    const p = v.play();
    if (p && typeof (p as any).catch === 'function') {
        (p as any).then(() => set('playing')).catch((err: any) => {
            if (err?.name === 'NotAllowedError') set('autoplay-blocked');
        });
    } else {
        set('playing');
    }
};

export default function useShareStream({
    videoRef,
    resolved,
    autoplay,
    muted,
    playing,
    volume,
}: UseShareStreamArgs): UseShareStreamResult {
    const [state, setState] = useState<ShareStreamState>('idle');

    // The URL we're feeding to hls.js. Tracks `resolved.src` from upstream
    // (which now flows through the SSE-driven overlay store), with a
    // one-shot swap to `-h264` for the rare case the backend hasn't yet
    // stamped the canonical URL.
    const [effectiveSrc, setEffectiveSrc] = useState<string | null>(null);
    const codecFallbackTriedRef = useRef(false);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const connectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const playingSinceRef = useRef<number>(0);

    // Per-attach token. Bumped whenever upstream changes the canonical URL,
    // OR the reactive codec fallback swaps variants. The HLS attach effect
    // keys off this so a same-URL SSE update (e.g. backend re-stamping the
    // same `-h264` we already tried) still tears down the prior hls instance
    // and re-attaches — otherwise a previously-failed attempt would stay
    // resident and the overlay would only recover after a toggle.
    const [attachToken, setAttachToken] = useState(0);

    const intendedSrc = resolved.kind === 'hls' ? resolved.src : null;
    useEffect(() => {
        setEffectiveSrc(intendedSrc);
        codecFallbackTriedRef.current = false;
        setAttachToken((t) => t + 1);
    }, [intendedSrc]);

    useEffect(() => {
        if (resolved.kind === 'ended') setState('idle');
    }, [resolved.kind]);

    const tryCodecFallback = useCallback((): boolean => {
        if (codecFallbackTriedRef.current) return false;
        const cur = effectiveSrc;
        if (!cur) return false;
        const fb = buildH264Fallback(cur);
        if (!fb) return false;
        codecFallbackTriedRef.current = true;
        setEffectiveSrc(fb);
        setAttachToken((t) => t + 1);
        return true;
    }, [effectiveSrc]);

    // ── MediaStream attach ───────────────────────────────────────────────
    useEffect(() => {
        if (resolved.kind !== 'stream') return;
        const v = videoRef.current;
        if (!v) return;

        if (v.srcObject !== resolved.stream) {
            try { v.srcObject = resolved.stream; } catch { /* noop */ }
        }
        v.muted = muted;
        v.volume = volume;
        v.autoplay = autoplay;
        v.playsInline = true;
        if (autoplay && playing) tryPlay(v, setState);

        return () => {
            try { if (v.srcObject === resolved.stream) v.srcObject = null; } catch { /* noop */ }
        };
    }, [
        resolved.kind,
        resolved.kind === 'stream' ? resolved.stream : null,
        autoplay, muted, playing, volume, videoRef,
    ]);

    // ── HLS attach ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!effectiveSrc) return;
        const v = videoRef.current;
        if (!v) return;

        v.muted = muted;
        v.volume = volume;
        v.playsInline = true;
        setState('connecting');

        let cancelled = false;
        let hls: any = null;
        let recovery = 0;

        // Stuck-watchdog: if hls.js loads the manifest but the codec can't be
        // decoded, the browser may never fire 'error' — it just silently
        // fails to buffer. Catch that with a timer; if it fires, the backend
        // simply hasn't observed the codec yet, so swap to -h264.
        let watchdog: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            if (cancelled) return;
            if (v.readyState < 2) tryCodecFallback();
        }, STUCK_WATCHDOG_MS);
        const clearWatchdog = () => { if (watchdog) { clearTimeout(watchdog); watchdog = null; } };

        const onLoadedData = () => clearWatchdog();
        const onPlaying    = () => clearWatchdog();
        const onNativeErr  = () => { clearWatchdog(); tryCodecFallback(); };
        v.addEventListener('loadeddata', onLoadedData);
        v.addEventListener('playing', onPlaying);
        v.addEventListener('error', onNativeErr);

        (async () => {
            try {
                const mod = await import('hls.js');
                const Hls = mod.default;
                if (cancelled) return;

                if (!Hls || !Hls.isSupported()) {
                    if (v.canPlayType?.('application/vnd.apple.mpegurl')) {
                        v.src = effectiveSrc;
                        v.load();
                        if (autoplay && playing) tryPlay(v, setState);
                    } else {
                        setState('error');
                    }
                    return;
                }

                hls = new Hls({
                    autoStartLoad: true,
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 0,
                    maxBufferLength: 6,
                    maxMaxBufferLength: 12,
                    liveSyncDurationCount: 1,
                    liveMaxLatencyDurationCount: 4,
                    maxLiveSyncPlaybackRate: 1.2,
                    manifestLoadingTimeOut: 4_000,
                    manifestLoadingMaxRetry: 2,
                    fragLoadingTimeOut: 6_000,
                    startFragPrefetch: true,
                    progressive: true,
                });
                hls.loadSource(effectiveSrc);
                hls.attachMedia(v);

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    if (autoplay && playing) tryPlay(v, setState);
                });
                hls.on(Hls.Events.MANIFEST_LOADED, () => { recovery = 0; });
                hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
                    if (!data?.fatal) return;
                    // Codec / buffer errors → swap to -h264 immediately.
                    const codecDetail = String(data?.details || '');
                    const looksLikeCodec =
                        codecDetail.includes('Codec') ||
                        codecDetail.includes('codec') ||
                        codecDetail.includes('bufferAppend') ||
                        codecDetail.includes('bufferIncompat');
                    if (looksLikeCodec && tryCodecFallback()) return;

                    if (recovery >= MAX_HLS_RECOVERY) {
                        if (tryCodecFallback()) return;
                        setState('connecting');
                        retryTimerRef.current = setTimeout(() => {
                            codecFallbackTriedRef.current = false;
                            setEffectiveSrc(effectiveSrc);
                            setAttachToken((t) => t + 1);
                        }, LONG_RETRY_MS);
                        return;
                    }
                    recovery += 1;
                    if (data.type === 'mediaError') {
                        hls.recoverMediaError();
                    } else if (data.type === 'networkError') {
                        setTimeout(() => { if (!cancelled) hls.startLoad(-1); }, HLS_NETWORK_RETRY_MS);
                    } else if (!tryCodecFallback()) {
                        setState('error');
                    }
                });
            } catch {
                setState('error');
            }
        })();

        return () => {
            cancelled = true;
            clearWatchdog();
            if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
            v.removeEventListener('loadeddata', onLoadedData);
            v.removeEventListener('playing', onPlaying);
            v.removeEventListener('error', onNativeErr);
            if (hls) safe(() => hls.destroy());
        };
    }, [attachToken, effectiveSrc, autoplay, playing, muted, volume, videoRef, tryCodecFallback]);

    // ── Reflect video element events into playback state ─────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const scheduleConnecting = () => {
            if (connectingTimerRef.current != null) return;
            const playingFor = playingSinceRef.current ? Date.now() - playingSinceRef.current : 0;
            if (playingFor >= 3000) {
                connectingTimerRef.current = setTimeout(() => {
                    setState((s) => (s === 'playing' ? 'connecting' : s));
                    connectingTimerRef.current = null;
                }, 1500);
            } else {
                setState((s) => (s === 'playing' ? 'connecting' : s));
            }
        };
        const onPlaying = () => {
            if (connectingTimerRef.current != null) {
                clearTimeout(connectingTimerRef.current);
                connectingTimerRef.current = null;
            }
            playingSinceRef.current = Date.now();
            setState('playing');
        };
        const onWaiting = () => scheduleConnecting();
        const onStalled = () => scheduleConnecting();
        v.addEventListener('playing', onPlaying);
        v.addEventListener('waiting', onWaiting);
        v.addEventListener('stalled', onStalled);
        return () => {
            v.removeEventListener('playing', onPlaying);
            v.removeEventListener('waiting', onWaiting);
            v.removeEventListener('stalled', onStalled);
            if (connectingTimerRef.current != null) {
                clearTimeout(connectingTimerRef.current);
                connectingTimerRef.current = null;
            }
        };
    }, [videoRef]);

    // ── Volume sync ──────────────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (v) v.volume = volume;
    }, [volume, videoRef]);

    const enableSound = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = false;
        tryPlay(v, setState);
    };

    return { state, enableSound };
}
