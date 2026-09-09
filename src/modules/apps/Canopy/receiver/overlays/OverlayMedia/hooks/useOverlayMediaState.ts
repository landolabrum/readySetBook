// useOverlayMediaState — orchestrator composing focused sub-hooks.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OverlayMediaKind, OverlayMediaSrcResult } from '../types';
import useHlsPlayer from './useHlsPlayer';
import useMjpegRecovery from './useMjpegRecovery';
import useMediaPlayback from './useMediaPlayback';
import useIframeAutoplay from './useIframeAutoplay';
import useMediaRuntimeControls from './useMediaRuntimeControls';

const safe = (fn?: () => void) => { try { fn?.(); } catch {} };

export type UseOverlayMediaStateArgs = {
    overlayId?: string | number;
    media: Pick<
        OverlayMediaSrcResult,
        | 'srcUrlRaw' | 'srcUrl' | 'ytId' | 'isHls' | 'isLikelyImageStream'
        | 'shouldForceIframe' | 'effectiveRequestedKind' | 'preferredKind'
        | 'wantsIframe' | 'hasPlaylist' | 'playlistLen'
    >;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    playing?: boolean | null;
    skipToNext?: () => void;
};

export type UseOverlayMediaStateResult = {
    normalizedKind: OverlayMediaKind;
    refs: {
        iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
        videoRef: React.MutableRefObject<HTMLVideoElement | null>;
        nextVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
    };
    loadError: boolean;
    errorSrc: string | null;
    errorLabel: string;
    recoveryEpoch: number;
    autoplayBlocked: boolean;
    /** True between "we have a source" and "first frame painted", and again on
     *  any subsequent stall/buffer event. The renderer uses this to surface a
     *  "Connecting…" / "Buffering…" pill so the producer is never left staring
     *  at the chroma-key surface wondering whether it's broken or loading. */
    connecting: boolean;
    /** True once the `<video>` has fired `loadeddata` or `playing` at least
     *  once for the current source. Lets the renderer suppress error/connect
     *  states once we have visible frames. */
    videoReady: boolean;
    actions: {
        play: () => void;
        pause: () => void;
        mute: () => void;
        unmute: () => void;
        restart: () => void;
        onIframeLoad: () => void;
        onVideoError: () => void;
        onImageError: () => void;
        onImageLoad: () => void;
        clearError: () => void;
        enableSound: () => void;
    };
};

export default function useOverlayMediaState({
    overlayId,
    media,
    autoplay = true,
    muted = true,
    playing = true,
    skipToNext,
}: UseOverlayMediaStateArgs): UseOverlayMediaStateResult {
    const {
        srcUrlRaw, srcUrl, ytId, isHls, isLikelyImageStream,
        shouldForceIframe, effectiveRequestedKind, preferredKind,
        wantsIframe, hasPlaylist, playlistLen,
    } = media;

    const isPlaying = playing !== false;

    // --- Refs ---
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const nextVideoRef = useRef<HTMLVideoElement | null>(null);
    const connectingTimerRef = useRef<number | null>(null);
    const videoReadyRef = useRef(false);

    // --- Kind override + error state ---
    const [kindOverride, setKindOverride] = useState<OverlayMediaKind | null>(null);
    const normalizedKind: OverlayMediaKind = kindOverride ?? preferredKind;

    const [loadError, setLoadError] = useState(false);
    const [errorSrc, setErrorSrc] = useState<string | null>(null);
    const errorLabel = useMemo(() => {
        if (!errorSrc) return '';
        try { return new URL(errorSrc).hostname || ''; } catch { return ''; }
    }, [errorSrc]);

    const clearError = useCallback(() => { setLoadError(false); setErrorSrc(null); }, []);

    useEffect(() => { setKindOverride(null); clearError(); }, [srcUrlRaw, preferredKind, clearError]);

    const handleLoadError = useCallback(() => {
        setLoadError(true);
        setErrorSrc(srcUrlRaw || null);
        if (hasPlaylist && playlistLen > 1) skipToNext?.();
    }, [srcUrlRaw, hasPlaylist, playlistLen, skipToNext]);

    // --- Image fallback state (shared between error handlers and MJPEG recovery) ---
    const [imageFallbackEnabled, setImageFallbackEnabled] = useState(true);
    useEffect(() => { setImageFallbackEnabled(true); }, [srcUrlRaw, preferredKind]);

    const setKindToImage = useCallback(() => setKindOverride('image'), []);

    // --- Autoplay-with-sound block (browser policy) ---
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    useEffect(() => { setAutoplayBlocked(false); }, [srcUrlRaw]);
    const onAutoplayBlocked = useCallback(() => setAutoplayBlocked(true), []);

    // --- Connecting / videoReady tracking (drives the in-tile status pill) ---
    const [connecting, setConnecting] = useState<boolean>(false);
    const [videoReady, setVideoReady] = useState<boolean>(false);
    useEffect(() => { videoReadyRef.current = videoReady; }, [videoReady]);
    useEffect(() => {
        // Reset both whenever the source changes — a new src means we're
        // connecting again from scratch.
        videoReadyRef.current = false;
        setVideoReady(false);
        if (connectingTimerRef.current != null) {
            clearTimeout(connectingTimerRef.current);
            connectingTimerRef.current = null;
        }
        setConnecting(Boolean(srcUrlRaw) && normalizedKind === 'video');
    }, [srcUrlRaw, normalizedKind]);
    useEffect(() => {
        const v = videoRef.current;
        if (!v || normalizedKind !== 'video') return;
        const scheduleConnecting = () => {
            if (connectingTimerRef.current != null) return;
            if (videoReadyRef.current) {
                connectingTimerRef.current = window.setTimeout(() => {
                    setConnecting(true);
                    connectingTimerRef.current = null;
                }, 1500);
            } else {
                setConnecting(true);
            }
        };
        const clearConnecting = () => {
            if (connectingTimerRef.current != null) {
                clearTimeout(connectingTimerRef.current);
                connectingTimerRef.current = null;
            }
            setConnecting(false);
        };
        const onLoadStart = () => { setConnecting(true); };
        const onLoadedData = () => { setVideoReady(true); clearConnecting(); };
        const onPlaying = () => { setVideoReady(true); clearConnecting(); };
        const onWaiting = () => { scheduleConnecting(); };
        const onStalled = () => { scheduleConnecting(); };
        const onEmptied = () => { setVideoReady(false); };
        v.addEventListener('loadstart', onLoadStart);
        v.addEventListener('loadeddata', onLoadedData);
        v.addEventListener('playing', onPlaying);
        v.addEventListener('waiting', onWaiting);
        v.addEventListener('stalled', onStalled);
        v.addEventListener('emptied', onEmptied);
        return () => {
            v.removeEventListener('loadstart', onLoadStart);
            v.removeEventListener('loadeddata', onLoadedData);
            v.removeEventListener('playing', onPlaying);
            v.removeEventListener('waiting', onWaiting);
            v.removeEventListener('stalled', onStalled);
            v.removeEventListener('emptied', onEmptied);
            if (connectingTimerRef.current != null) {
                clearTimeout(connectingTimerRef.current);
                connectingTimerRef.current = null;
            }
        };
    }, [normalizedKind, srcUrlRaw]);
    const enableSound = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = false;
        const p = v.play();
        if (p && typeof (p as any).catch === 'function') {
            (p as any).then(() => setAutoplayBlocked(false)).catch(() => {});
        } else {
            setAutoplayBlocked(false);
        }
    }, []);

    // --- Sub-hooks ---
    const { recoveryEpoch } = useMjpegRecovery({
        srcUrlRaw, isLikelyImageStream, normalizedKind, loadError,
        clearError, setImageFallbackEnabled, setKindOverride: setKindToImage,
    });

    useHlsPlayer({
        videoRef, srcUrlRaw, isHls, normalizedKind, autoplay, isPlaying,
        onFatalError: handleLoadError,
        onAutoplayBlocked,
    });

    const playback = useMediaPlayback({
        normalizedKind, iframeRef, videoRef, ytId, isPlaying, muted,
    });

    const { onIframeLoad } = useIframeAutoplay({
        iframeRef, normalizedKind, autoplay, isPlaying, ytId,
        clearError, onLoadTimeout: handleLoadError,
    });

    useMediaRuntimeControls({ overlayId, ...playback });

    // --- Reload video on source change (playlist progression) ---
    useEffect(() => {
        const v = videoRef.current;
        if (!v || normalizedKind !== 'video' || isHls) return;
        v.load();
        if (autoplay && isPlaying) {
            const p = v.play();
            if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
        }
    }, [srcUrl, normalizedKind, isHls, autoplay, isPlaying]);

    // --- Error fallback cascade: video → image → iframe ---
    const onVideoError = useCallback(() => {
        if (isHls) return;
        if (imageFallbackEnabled && normalizedKind !== 'image') { setKindOverride('image'); return; }
        if (wantsIframe) { setKindOverride('iframe'); return; }
        handleLoadError();
    }, [isHls, imageFallbackEnabled, normalizedKind, wantsIframe, handleLoadError]);

    const onImageError = useCallback(() => {
        if (isLikelyImageStream) { handleLoadError(); return; }
        setImageFallbackEnabled(false);
        if (isHls) { setKindOverride('video'); return; }
        if (effectiveRequestedKind === 'video' && !shouldForceIframe) { setKindOverride('video'); return; }
        if (wantsIframe) { setKindOverride('iframe'); return; }
        handleLoadError();
    }, [isLikelyImageStream, isHls, effectiveRequestedKind, shouldForceIframe, wantsIframe, handleLoadError]);

    const onImageLoad = useCallback(() => clearError(), [clearError]);

    return {
        normalizedKind,
        refs: { iframeRef, videoRef, nextVideoRef },
        loadError, errorSrc, errorLabel, recoveryEpoch, autoplayBlocked,
        connecting, videoReady,
        actions: {
            ...playback,
            onIframeLoad, onVideoError, onImageError, onImageLoad, clearError,
            enableSound,
        },
    };
}
