// Relative Path: ./useCanopyViewState.ts
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNotification } from '@webstack/components/Notification/Notification';
import { useOverlayStore, LS_OVERLAY_PREFIX, LS_META_PREFIX } from './useOverlayStore';
import { useLiveStreamCtx } from '@Canopy/context/CanopyProvider';
import useLocalStorage from '@webstack/hooks/storage/useLocalStorage';
import { enabledOnly, OVERLAY_TYPES } from '../models/canopyOverlayTypes';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
export const overlayTypeIcon: Record<string, string> = {
    scoreboard: 'fa-list-ul',
    ticker: 'fa-newspaper',
    map: 'fa-map',
    hud: 'fa-gauge-med',
    lapcounter: 'fa-flag',
    media: 'fa-photo-film',
    weather: 'fa-cloud-sun',
    camera: 'fa-camera-security',
    screen: 'fa-mobile-screen',
    encoder: 'fa-broadcast-tower',
    pull: 'fa-download',
    card: 'fa-id-card',
    chat: 'fa-message-dots',
};
const sameJson = (a: unknown, b: unknown) => {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
};

const useDebounced = (delay = 250) => {
    const t = useRef<ReturnType<typeof setTimeout> | null>(null);
    const run = useCallback((fn: () => void) => {
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => {
            t.current = null;
            fn();
        }, delay);
    }, [delay]);
    useEffect(() => () => {
        if (t.current) clearTimeout(t.current);
    }, []);
    return run;
};

export const useCanopyViewState = (current: any) => {
    const eventId: string | undefined = current?.id;
    const eventName: string = current?.name ?? 'Untitled Event';

    const lsKey = eventId ? `${LS_OVERLAY_PREFIX}${eventId}` : undefined;
    const metaKey = eventId ? `${LS_META_PREFIX}${eventId}` : undefined;

    const [, setNotification] = useNotification();
    const { openModal, closeModal } = useModal();
    const { overlays, setOverlays, meta } = useOverlayStore(eventId, current?.name);
    const active = useMemo(() => enabledOnly(overlays), [overlays]);

    const {
        getOverlaysById,
        saveOverlaysById,
        loadRoster,
        roster,
        overlays: liveOverlays,
    } = useLiveStreamCtx();

    const { setLocalItem, getLocalItem } = useLocalStorage(lsKey);
    const [serverOverlays, setServerOverlays] = useState<any[] | null>(null);
    const rehydratePromptRef = useRef<{ key?: string; resolved?: boolean; active?: boolean }>({});

    const showLiveKey = eventId ? `canopy:showLive:${eventId}` : undefined;
    const { getLocalItem: getShowLive, setLocalItem: setShowLiveLS } = useLocalStorage(showLiveKey);
    // State: show live overlays or editor overlays False
    const [showLive, setShowLive] = useState(false);
    const [pushing, setPushing] = useState(false);
    const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
    const debounced = useDebounced(250);

    // Seed showLive from local storage
    useEffect(() => {
        if (!showLiveKey) {
            setShowLive(false);
            return;
        }
        const stored = getShowLive?.(showLiveKey);
        if (stored === false || stored === 'false') {
            setShowLive(false);
        } else if (stored === true || stored === 'true') {
            setShowLive(true);
        } else {
            setShowLive(true);
        }
    }, [showLiveKey, getShowLive]);

    const onChangeShowLive = useCallback((val: boolean) => {
        setShowLive(val);
        if (showLiveKey) setShowLiveLS?.(showLiveKey, val);
    }, [showLiveKey, setShowLiveLS]);

    // Fetch server overlays
    useEffect(() => {
        if (!eventId) return;
        void (async () => {
            const data = await getOverlaysById(String(eventId), { force: false });
            if (data) setServerOverlays(data);
        })();
    }, [eventId, getOverlaysById]);

    useEffect(() => {
        if (!eventId) return;
        void loadRoster(String(eventId));
    }, [eventId, loadRoster]);

    // Load from local storage on mount
    useEffect(() => {
        if (!lsKey) return;
        try {
            const stored = getLocalItem?.(lsKey);
            if (stored && Array.isArray(stored)) setOverlays(stored);
        } catch { }
    }, [lsKey, getLocalItem, setOverlays]);

    // Persist to local storage
    useEffect(() => {
        if (!lsKey) return;
        debounced(() => {
            try {
                setLocalItem(lsKey, overlays);
            } catch { }
        });
    }, [overlays, lsKey, setLocalItem, debounced]);

    // Offer to rehydrate local overlays from live data when cache is empty
    useEffect(() => {
        const key = eventId ? String(eventId) : undefined;
        const hasServer = Array.isArray(serverOverlays) && serverOverlays.length > 0;
        const hasLocal = Array.isArray(overlays) && overlays.length > 0;
        const serverSnapshot = hasServer ? [...serverOverlays!] : [];

        if (!key || !hasServer || hasLocal) {
            if (rehydratePromptRef.current.key !== key) {
                rehydratePromptRef.current = { key, resolved: hasLocal, active: false };
            } else {
                rehydratePromptRef.current.active = false;
            }
            return;
        }

        const state = rehydratePromptRef.current;
        if (state.key !== key) {
            rehydratePromptRef.current = { key, resolved: false, active: false };
        } else if (state.resolved || state.active) {
            return;
        }

        rehydratePromptRef.current = { key, resolved: false, active: true };

        openModal({
            title: 'Load live overlays?',
            confirm: {
                body: `Live overlays exist for "${eventName}", but your local editor is empty. Choose how to proceed.`,
                statements: [
                    {
                        label: 'Keep local empty state',
                        variant: 'flat',
                        onClick: () => {
                            rehydratePromptRef.current = { key, resolved: true, active: false };
                            closeModal();
                        },
                    },
                    {
                        label: 'Load live overlays',
                        variant: 'primary',
                        onClick: () => {
                            setOverlays(serverSnapshot);
                            setNotification({
                                active: true,
                                persistence: 2500,
                                list: [{ label: 'Synced', message: 'Live overlays restored from server.' }],
                            });
                            rehydratePromptRef.current = { key, resolved: true, active: false };
                            closeModal();
                        },
                    },
                ],
            },
        });
    }, [eventId, overlays, serverOverlays, openModal, closeModal, setOverlays, setNotification, eventName]);

    const canPush = useMemo(() => {
        if (!serverOverlays) return false;
        return !sameJson(overlays, serverOverlays);
    }, [overlays, serverOverlays]);

    const canUndo = canPush;

    const onGoLive = useCallback(async () => {
        if (!eventId || pushing) return;
        setPushing(true);
        try {
            const ok = await saveOverlaysById(String(eventId), overlays);
            if (ok) {
                setServerOverlays(overlays);
                setNotification({ active: true, persistence: 2500, list: [{ label: 'Pushed', message: 'Overlays are now live' }] });
            } else {
                setNotification({ active: true, persistence: 2500, list: [{ label: 'Push failed' }] });
            }
        } finally {
            setPushing(false);
        }
    }, [eventId, pushing, overlays, saveOverlaysById, setNotification]);

    const onUndo = useCallback(() => {
        if (!serverOverlays) return;
        setOverlays(serverOverlays);
        setNotification({ active: true, persistence: 1500, list: [{ label: 'Reverted', message: 'Changes discarded' }] });
    }, [serverOverlays, setOverlays, setNotification]);

    const focusOverlay = useCallback((id: string) => {
        setSelectedOverlayId(id);
        // Dispatch event so CanopyOverlayControls can show the correct overlay's controls
        window.dispatchEvent(new CustomEvent('canopy:focus-overlay', { detail: { id } }));
    }, []);

    // Listen for focus-overlay events from CanopyMedia clicks to sync selection
    useEffect(() => {
        const handler = (e: Event) => {
            const id = (e as CustomEvent)?.detail?.id;
            if (id) setSelectedOverlayId(id);
        };
        window.addEventListener('canopy:focus-overlay', handler);
        return () => window.removeEventListener('canopy:focus-overlay', handler);
    }, []);

    const removeOverlay = useCallback((id: string) => {
        setOverlays((prev) => prev.filter((ov) => ov.id !== id));
    }, [setOverlays]);

    const reorderOverlays = useCallback((orderedIds: string[]) => {
        setOverlays((prev) => {
            const map = new Map(prev.map((ov) => [ov.id, ov]));
            const ordered = orderedIds.map((id) => map.get(id)).filter(Boolean) as any[];
            // Cascade z_index: top of list gets highest z, bottom gets 1
            return ordered.map((ov: any, idx: number) => ({
                ...ov,
                z_index: ordered.length - idx,
            }));
        });
    }, [setOverlays]);

    const addOverlay = useCallback((type: string) => {
        const newId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setOverlays((prev) => {
            const maxZ = prev.reduce((mx, ov) => Math.max(mx, typeof ov.z_index === 'number' ? ov.z_index : 0), 0);
            const newOverlay = {
                id: newId,
                type: type as any,
                enabled: true,
                z_index: maxZ + 1,
                data: {
                    ...(type === 'screen' ? { _pendingShare: true } : {}),
                } as any,
            };
            return [...prev, newOverlay as any];
        });
        focusOverlay(newId);
    }, [setOverlays, focusOverlay]);

    // Update overlay size — width/height as % of design surface (0–100).
    // Accepts optional x/y so resize from nw/sw/ne corners can commit position atomically.
    const updateOverlaySize = useCallback((id: string, width: number, height: number, x?: number, y?: number) => {
        setOverlays((prev) =>
            prev.map((ov) => {
                if (ov.id !== id) return ov;
                const w = Math.round(width * 100) / 100;
                const h = Math.round(height * 100) / 100;
                const update: any = { ...ov, width: w, height: h };
                if (x != null) update.x = x;
                if (y != null) update.y = y;
                return update;
            })
        );
    }, [setOverlays]);

    // Update overlay crop [top, bottom, left, right] in % of design surface
    const updateOverlayCrop = useCallback((id: string, crop: [number, number, number, number]) => {
        setOverlays((prev) =>
            prev.map((ov) => {
                if (ov.id !== id) return ov;
                const rounded = crop.map(v => Math.round(v * 100) / 100) as [number, number, number, number];
                return { ...ov, crop: rounded.every(v => v === 0) ? undefined : rounded };
            })
        );
    }, [setOverlays]);

    // Update overlay position (x/y)
    const updateOverlayPosition = useCallback((id: string, x: number, y: number) => {
        setOverlays((prev) =>
            prev.map((ov) =>
                ov.id === id
                    ? { ...ov, x, y }
                    : ov
            )
        );
    }, [setOverlays]);

    // Generic partial update for any overlay fields (z_index, enabled, etc.)
    const updateOverlay = useCallback((id: string, partial: Record<string, any>) => {
        setOverlays((prev) =>
            prev.map((ov) =>
                ov.id === id ? { ...ov, ...partial } : ov
            )
        );
    }, [setOverlays]);

    // Duplicate an overlay — deep-clone with new id, z_index = max + 1, offset +2% x/y
    const duplicateOverlay = useCallback((id: string) => {
        setOverlays((prev) => {
            const source = prev.find((ov) => ov.id === id);
            if (!source) return prev;
            const clone = JSON.parse(JSON.stringify(source));
            const newId = `${source.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const maxZ = prev.reduce((mx, ov) => Math.max(mx, typeof ov.z_index === 'number' ? ov.z_index : 0), 0);
            clone.id = newId;
            clone.z_index = maxZ + 1;
            clone.x = Math.min(100, (clone.x ?? 0) + 2);
            clone.y = Math.min(100, (clone.y ?? 0) + 2);
            return [...prev, clone];
        });
    }, [setOverlays]);

    const overlayTable = useMemo(() => {
        // Guard against undefined/null overlays array
        if (!Array.isArray(overlays)) return [];

        return overlays.map((ov) => {
            return {
                id: ov.id,
                label: ov.label ?? '',
                icon: overlayTypeIcon[ov.type] || 'fa-picture-in-picture',
                action: { icon: overlayTypeIcon[ov.type] || 'fa-picture-in-picture', size: 18, alt: ov.type },
                enabled: ov.enabled,
                type: ov.type,
            };
        });
    }, [overlays]);

    return {
        eventId,
        eventName,
        overlays,
        setOverlays,
        meta,
        roster,
        showLive,
        onChangeShowLive,
        pushing,
        canPush,
        canUndo,
        onGoLive,
        onUndo,
        focusOverlay,
        selectedOverlayId,
        removeOverlay,
        reorderOverlays,
        addOverlay,
        updateOverlaySize,
        updateOverlayCrop,
        updateOverlayPosition,
        updateOverlay,
        duplicateOverlay,
        overlayTable,
        liveOverlays,
    };
};
