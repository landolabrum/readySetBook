import { useCallback, useEffect, useMemo, useRef } from "react";
import useLocalStorage from "@webstack/hooks/storage/useLocalStorage";
import { useOverlayStore, LS_META_PREFIX } from "@Canopy/hooks/useOverlayStore";
import { useLiveStreamCtx } from "@Canopy/context/CanopyProvider";
import {
    CanonOverlay,
    OverlayIdContext,
    OverlayType,
    defaultOverlayFor,
    enabledRealOverlaysOnly,
    jsonStable,
    realOverlaysOnly,
} from "@Canopy/models/canopyOverlayTypes";

export type Notifier = (payload: any) => void;

export const useOverlaysForEvent = (
    {
        eventId,
        eventName,
        userId,
        setNotification,
    }: {
        eventId?: string;
        eventName?: string;
        userId?: string;
        setNotification?: Notifier;
    }
) => {
    const metaKey = eventId ? `${LS_META_PREFIX}${eventId}` : undefined;
    const { setLocalItem, getLocalItem } = useLocalStorage(metaKey);
    const { saveOverlaysById, getOverlaysById } = useLiveStreamCtx();
    const { overlays: storeOverlays, setOverlays } = useOverlayStore(eventId, eventName ?? undefined);
    const seededForRef = useRef<string | null>(null);

    const overlaysArr: CanonOverlay[] = useMemo(() => {
        return Array.isArray(storeOverlays) ? (storeOverlays as CanonOverlay[]) : [];
    }, [storeOverlays]);

    useEffect(() => {
        if (!eventId) {
            seededForRef.current = null;
            setOverlays([] as any);
            return;
        }

        // Seed once per event to avoid overwriting local edits on every change
        if (seededForRef.current === eventId) return;
        seededForRef.current = eventId;

        (async () => {
            try {
                const list = await getOverlaysById(String(eventId), { force: true });
                const canon = Array.isArray(list) ? list : [];
                const serverHasRealAny = realOverlaysOnly(canon).length > 0;

                if (!serverHasRealAny && enabledRealOverlaysOnly(overlaysArr).length > 0) {
                    setNotification?.({
                        active: true,
                        dismissable: true,
                        persistence: 4000,
                        list: [{
                            label: "Live snapshot empty",
                            message: "Server returned no overlays; keeping your local overlays instead.",
                        }],
                    });
                    return;
                }

                setOverlays(() => canon as any);
                if (metaKey && serverHasRealAny) setLocalItem(metaKey, { seedHash: jsonStable(canon), edited: false });
            } catch {
                /* keep local state if fetch fails */
            }
        })();
    }, [eventId, metaKey, setLocalItem, setOverlays, getOverlaysById, setNotification, overlaysArr]);

    const focusOverlay = useCallback(
        (overlayId?: string) => {
            if (!overlayId) return;
            try {
                if (metaKey) {
                    const prev = (getLocalItem?.(metaKey) as any) || {};
                    setLocalItem(metaKey, { ...prev, t: overlayId });
                }
                if (typeof window !== "undefined") {
                    const ev = new CustomEvent("canopy:focus-overlay", { detail: { id: overlayId } });
                    window.dispatchEvent(ev);
                }
            } catch {
                /* ignore */
            }
        },
        [metaKey, getLocalItem, setLocalItem]
    );

    const addOverlay = useCallback(
        (type: OverlayType) => {
            const base = Array.isArray(overlaysArr) ? overlaysArr : [];
            const maxZ = base.reduce((max, ov) => {
                const z = Number(ov?.z_index ?? 0);
                return Number.isFinite(z) && z > max ? z : max;
            }, 0);

            // Build ID context for deterministic overlay IDs
            const idCtx: OverlayIdContext = { userId, streamId: eventId };
            const baseDefault = defaultOverlayFor(type, eventName ?? undefined, true, idCtx);

            // Use deterministic ID based on userId + streamId + type, fallback to timestamp-based if no context
            const overlayId = (userId && eventId)
                ? `${userId}-${eventId}-${type}`
                : `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const nextOverlay: CanonOverlay = {
                ...baseDefault,
                id: overlayId,
                type,
                enabled: true,
                z_index: maxZ + 1,
            };

            const next: CanonOverlay[] = [...base, nextOverlay];
            setOverlays(() => next);

            if (metaKey) {
                const prev = (getLocalItem?.(metaKey) as any) || {};
                setLocalItem(metaKey, { ...prev, t: nextOverlay.id });
            }

            // For device overlays, keep local-only until an explicit Push Live to avoid premature DB writes
            if (eventId && saveOverlaysById && (type as string) !== 'device') {
                const payloadForSave = next;

                saveOverlaysById(String(eventId), payloadForSave as any)
                    .then(() => {
                        setOverlays(() => payloadForSave as any);
                    })
                    .catch((err) => {
                        console.error(`❌ Database save failed for ${type} overlay:`, err);
                    });
            }

            focusOverlay(nextOverlay.id);
        },
        [eventId, eventName, userId, overlaysArr, setOverlays, saveOverlaysById, getOverlaysById, focusOverlay, metaKey, setLocalItem, getLocalItem]
    );

    const removeOverlay = useCallback(
        (overlayId?: string) => {
            if (!overlayId) return;
            setOverlays((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const next = list.filter((o) => String(o?.id) !== String(overlayId));
                return next as any;
            });

            if (metaKey) {
                try {
                    const prevMeta = (getLocalItem?.(metaKey) as any) || {};
                    const nextMeta = { ...prevMeta } as any;
                    if (String((prevMeta as any)?.t ?? "") === String(overlayId)) {
                        delete nextMeta.t;
                    }
                    setLocalItem(metaKey, nextMeta);
                } catch {
                    /* ignore */
                }
            }

            if (eventId && saveOverlaysById) {
                const nextList = overlaysArr.filter((o) => String(o?.id) !== String(overlayId));
                void saveOverlaysById(String(eventId), nextList as any).catch(() => {
                    /* non-fatal */
                });
            }

            if (typeof window !== "undefined") {
                try {
                    const ev = new CustomEvent("canopy:focus-overlay", { detail: { id: undefined } });
                    window.dispatchEvent(ev);
                } catch {
                    /* ignore */
                }
            }
        },
        [eventId, overlaysArr, getLocalItem, metaKey, saveOverlaysById, setLocalItem, setOverlays]
    );

    const toggleOverlayEnabled = useCallback(
        (overlayId: string, enabled: boolean) => {
            if (!overlayId) return;
            const base = Array.isArray(overlaysArr) ? overlaysArr : [];
            const next = base.map((ov) => (String(ov?.id) === String(overlayId) ? { ...ov, enabled } : ov));
            setOverlays(() => next as any);

            if (eventId && saveOverlaysById) {
                void saveOverlaysById(String(eventId), next as any).catch(() => {
                    /* non-fatal */
                });
            }
        },
        [eventId, overlaysArr, saveOverlaysById, setOverlays]
    );

    const reorderOverlays = useCallback(
        (orderedIds: string[]) => {
            if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
            const base = Array.isArray(overlaysArr) ? overlaysArr : [];

            const seen = new Set<string>();
            const ordered: CanonOverlay[] = [];

            for (const rawId of orderedIds) {
                const id = String(rawId);
                if (seen.has(id)) continue;
                const match = base.find((ov) => String(ov?.id) === id);
                if (match) {
                    seen.add(id);
                    ordered.push(match);
                }
            }

            const leftovers = base.filter((ov) => !seen.has(String(ov?.id)));
            const next = [...ordered, ...leftovers].map((ov, idx, arr) => ({
                ...ov,
                z_index: arr.length - idx,
            }));

            setOverlays(() => next as any);

            if (eventId && saveOverlaysById) {
                void saveOverlaysById(String(eventId), next as any).catch(() => {
                    /* non-fatal */
                });
            }
        },
        [eventId, overlaysArr, saveOverlaysById, setOverlays]
    );

    const isTypeEnabled = useCallback(
        (type: string) => enabledRealOverlaysOnly(overlaysArr).some((o) => String(o?.type).toLowerCase() === String(type).toLowerCase()),
        [overlaysArr]
    );

    return { overlaysArr, addOverlay, removeOverlay, focusOverlay, reorderOverlays, toggleOverlayEnabled, isTypeEnabled };
};
