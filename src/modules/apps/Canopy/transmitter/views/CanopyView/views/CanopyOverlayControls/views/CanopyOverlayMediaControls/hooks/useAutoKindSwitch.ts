import { useEffect } from 'react';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';

/**
 * Automatically adjusts the overlay `data.kind` based on the media source URL:
 * - HLS (.m3u8) → force `video` (away from iframe)
 * - YouTube URL → force `iframe`
 */
export function useAutoKindSwitch(overlay: CanonOverlay, onChange: (e: any) => void) {
    const src = (overlay as any)?.data?.src as string | undefined;
    const kind = String((overlay as any)?.data?.kind || 'video').toLowerCase();

    // HLS streams should use the native video player, not an iframe
    useEffect(() => {
        if (!src) return;
        const isHls = src.toLowerCase().includes('.m3u8');
        if (isHls && kind === 'iframe') {
            onChange({ target: { name: 'data.kind', value: 'video' } });
        }
    }, [src, kind, onChange]);

    // YouTube embeds require an iframe
    useEffect(() => {
        if (!src) return;
        const isYouTube = (() => {
            try {
                const u = new URL(src);
                const host = u.hostname.replace(/^www\./, '').toLowerCase();
                return host === 'youtu.be' || host.endsWith('youtube.com');
            } catch {
                return false;
            }
        })();
        if (isYouTube && kind !== 'iframe') {
            onChange({ target: { name: 'data.kind', value: 'iframe' } });
        }
    }, [src, kind, onChange]);
}
