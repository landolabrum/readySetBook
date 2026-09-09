// useOverlayMediaSrc — resolves playlist, URL, kind for OverlayMedia.
import { useMemo } from 'react';
import type { OverlayMediaKind, OverlayMediaSrcResult } from '../types';
import {
    normalizeKind,
    parseYouTubeId,
    isIframeEmbed,
    detectHls,
    detectLikelyImageStream,
    buildYouTubeEmbedUrl,
    buildGenericEmbedUrl,
} from '../utils/detection';

// Re-export for backward compat.
export type { OverlayMediaKind } from '../types';

export type UseOverlayMediaSrcArgs = {
    kind?: 'video' | 'iframe' | 'image' | string | null;
    src?: string | null;
    urls?: string[] | null;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    currentIndex?: number;
};

export type UseOverlayMediaSrcResult = OverlayMediaSrcResult;

export default function useOverlayMediaSrc(args: UseOverlayMediaSrcArgs): UseOverlayMediaSrcResult {
    const {
        kind,
        src,
        urls,
        autoplay = true,
        loop = false,
        muted = true,
        currentIndex = 0,
    } = args;

    const playlist = useMemo(() => {
        return Array.isArray(urls) ? urls.map(u => String(u || '').trim()).filter(Boolean) : [];
    }, [urls]);

    const playlistLen = playlist.length;
    const hasPlaylist = playlistLen > 0;

    const srcUrlRaw = useMemo(() => {
        const raw = hasPlaylist ? playlist[currentIndex % playlistLen] : String(src ?? '').trim();
        return raw;
    }, [hasPlaylist, playlist, playlistLen, currentIndex, src]);

    const requestedKind = useMemo(() => normalizeKind(kind), [kind]);

    const ytId = useMemo(() => (srcUrlRaw ? parseYouTubeId(srcUrlRaw) : null), [srcUrlRaw]);

    const isHls = useMemo(() => detectHls(srcUrlRaw), [srcUrlRaw]);

    // HLS MUST be video (prevents iframe navigation/download behavior)
    const effectiveRequestedKind = useMemo<OverlayMediaKind>(() => {
        if (isHls) return 'video';
        return requestedKind;
    }, [isHls, requestedKind]);

    const isLikelyImageStream = useMemo(() => detectLikelyImageStream(srcUrlRaw), [srcUrlRaw]);

    const shouldForceIframe = useMemo(() => {
        if (isHls) return false;
        return Boolean(ytId || isIframeEmbed(srcUrlRaw));
    }, [isHls, ytId, srcUrlRaw]);

    const preferredKind = useMemo<OverlayMediaKind>(() => {
        if (isHls) return 'video';
        if (shouldForceIframe) return 'iframe';
        if (effectiveRequestedKind === 'image') return 'image';
        if (effectiveRequestedKind === 'iframe' && !isLikelyImageStream) return 'iframe';
        if (isLikelyImageStream) return 'image';
        return 'video';
    }, [isHls, shouldForceIframe, effectiveRequestedKind, isLikelyImageStream]);

    const wantsIframe = useMemo(() => {
        if (isHls) return false;
        return effectiveRequestedKind === 'iframe' || shouldForceIframe;
    }, [isHls, effectiveRequestedKind, shouldForceIframe]);

    const srcUrl = useMemo(() => {
        if (!srcUrlRaw) return '';
        if (ytId) return buildYouTubeEmbedUrl(ytId, { autoplay, muted, loop });
        if (isIframeEmbed(srcUrlRaw)) return buildGenericEmbedUrl(srcUrlRaw, { autoplay, muted, loop });
        return srcUrlRaw;
    }, [srcUrlRaw, ytId, autoplay, muted, loop]);

    return {
        playlist,
        playlistLen,
        hasPlaylist,

        srcUrlRaw,
        srcUrl,

        ytId,
        isHls,
        isLikelyImageStream,
        shouldForceIframe,

        requestedKind,
        effectiveRequestedKind,
        preferredKind,
        wantsIframe,
    };
}
