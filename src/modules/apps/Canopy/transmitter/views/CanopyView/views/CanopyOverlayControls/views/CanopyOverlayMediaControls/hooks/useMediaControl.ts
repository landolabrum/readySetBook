import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getService } from '@webstack/common';
import IDataBaseService from '~/src/core/services/DataBaseService/IDataBaseService';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';

interface UseMediaControlOptions {
    overlay: CanonOverlay;
    eventId?: string | number;
}

/**
 * Manages real-time media control dispatch (play/pause/mute/unmute/restart),
 * cross-window BroadcastChannel relay, and DB persistence.
 */
export function useMediaControl({ overlay, eventId }: UseMediaControlOptions) {
    const startingMuted = Boolean((overlay as any)?.data?.muted ?? false);
    const startingPlaying = Boolean((overlay as any)?.data?.playing ?? true);

    const [liveMuted, setLiveMuted] = useState(startingMuted);
    const [livePlaying, setLivePlaying] = useState(startingPlaying);
    const channelRef = useRef<BroadcastChannel | null>(null);

    const db = useMemo(() => getService<IDataBaseService>('IDataBaseService'), []);

    // Cross-window BroadcastChannel so /live tab listens in OBS/another window.
    useEffect(() => {
        if (typeof window === 'undefined' || !(window as any).BroadcastChannel) return;
        const ch = new BroadcastChannel('canopy-media-control');
        channelRef.current = ch;
        return () => {
            try { ch.close(); } catch { /* ignore */ }
            channelRef.current = null;
        };
    }, []);

    // ---- DB persistence ----
    const persistState = useCallback(
        async (partial: { muted?: boolean; playing?: boolean }) => {
            const overlayId = (overlay as any)?.id;
            const eventIdRaw = (overlay as any)?.event_id ?? (overlay as any)?.eventId ?? eventId;
            const eventIdNum = Number(eventIdRaw);
            if (!overlayId || !Number.isFinite(eventIdNum)) return;

            try {
                const res = await db.selectData({
                    tableName: 'livestream_event_overlay',
                    where: { exact: { event_id: eventIdNum } },
                });
                const row = Array.isArray((res as any)?.data) ? (res as any).data[0] : null;
                const state = Array.isArray((row as any)?.state) ? (row as any).state : [];

                let updated = false;
                const nextState = state.map((entry: any) => {
                    if (String(entry?.id) === String(overlayId)) {
                        updated = true;
                        return { ...entry, data: { ...(entry?.data || {}), ...partial } };
                    }
                    return entry;
                });

                if (!updated) {
                    nextState.push({ ...overlay, data: { ...((overlay as any)?.data || {}), ...partial } });
                }

                const upd = await db.updateData({
                    tableName: 'livestream_event_overlay',
                    set: { state: nextState },
                    where: { exact: { event_id: eventIdNum } },
                });

                if (!Array.isArray((upd as any)?.data) || !(upd as any).data.length) {
                    await db.insertData({
                        tableName: 'livestream_event_overlay',
                        values: { event_id: eventIdNum, state: nextState } as any,
                    });
                }

                try {
                    if (typeof (db as any)?.pingOverlay === 'function') {
                        await (db as any).pingOverlay(eventIdNum);
                    }
                } catch { /* non-fatal */ }
            } catch { /* best-effort */ }
        },
        [overlay, eventId, db],
    );

    // ---- Dispatch action to in-page listeners + cross-window broadcast ----
    const dispatchControl = useCallback(
        (action: 'play' | 'pause' | 'mute' | 'unmute' | 'restart') => {
            const overlayId = (overlay as any)?.id;
            window.dispatchEvent(new CustomEvent('canopy:media-control', { detail: { action, overlayId } }));
            try { channelRef.current?.postMessage({ action, overlayId, ts: Date.now() }); } catch { /* ignore */ }
        },
        [overlay],
    );

    // ---- Convenience handlers that toggle state + dispatch + persist ----
    const togglePlay = useCallback(() => {
        const action = livePlaying ? 'pause' : 'play';
        setLivePlaying((p) => !p);
        dispatchControl(action);
        void persistState({ playing: !livePlaying });
    }, [livePlaying, dispatchControl, persistState]);

    const toggleMute = useCallback(() => {
        const action = liveMuted ? 'unmute' : 'mute';
        setLiveMuted((m) => !m);
        dispatchControl(action);
        void persistState({ muted: !liveMuted });
    }, [liveMuted, dispatchControl, persistState]);

    const restart = useCallback(() => dispatchControl('restart'), [dispatchControl]);

    return { liveMuted, livePlaying, togglePlay, toggleMute, restart } as const;
}
