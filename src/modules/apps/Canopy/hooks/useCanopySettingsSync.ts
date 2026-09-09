/**
 * useCanopySettingsSync
 *
 * Syncs Canopy per-event localStorage settings to the server so the user's
 * last event and UI layout restore seamlessly when switching devices.
 *
 * - **Push**: fires when the URL `?event=` query changes (user commits to an event switch).
 * - **Hydrate**: on mount, if `livestream_event:current` is empty in localStorage,
 *   pulls settings from the server, populates localStorage, and returns the last event id.
 */
import { useCallback, useRef, useMemo } from 'react';
import { getService } from '@webstack/common';
import type IMemberService from '~/src/core/services/MemberService/IMemberService';
import { useUser } from '~/src/core/authentication/hooks/useUser';
import {
    LS_OVERLAY_PREFIX,
    overlaysKeyFor,
    metaKeyFor,
} from './useOverlayStore';
import type { IUserSiteSettings, ICanopyEventSettings } from '~/src/models/ICustomer';
import { normalizeOverlayArray } from '@Canopy/models/canopyOverlayTypes';

const DEFAULT_SHOW_LIVE = false;

const LS_KEY_CURRENT = 'livestream_event:current';
const LS_SHOW_LIVE_PREFIX = 'canopy:showLive:';
const LS_RESIZER_PREFIX = 'canopy-resizer-';
const LS_RIGHT_SIDE_PREFIX = 'canopy-right-side-';

// ── helpers ─────────────────────────────────────────────────────────────────

/** Read a value from localStorage, unwrapping {value, expiry} wrappers. */
function readLS(key: string): any {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null) return undefined;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'value' in parsed) return parsed.value;
        return parsed;
    } catch {
        return undefined;
    }
}

/** Write a value to localStorage wrapped in {value} to match useLocalStorage. */
function writeLS(key: string, value: any): void {
    try {
        localStorage.setItem(key, JSON.stringify({ value }));
    } catch { /* quota exceeded etc */ }
}

/** Collect Canopy localStorage state for a single event. */
function collectEventSettings(eventId: string): ICanopyEventSettings {
    const overlaysKey = overlaysKeyFor(eventId);
    const metaKey = metaKeyFor(eventId);
    return {
        overlays: overlaysKey ? readLS(overlaysKey) ?? [] : [],
        meta: metaKey ? readLS(metaKey) ?? {} : {},
        show_live: readLS(`${LS_SHOW_LIVE_PREFIX}${eventId}`) ?? DEFAULT_SHOW_LIVE,
        resizer_sizes: readLS(`${LS_RESIZER_PREFIX}${eventId}`) ?? undefined,
        right_side_sizes: readLS(`${LS_RIGHT_SIDE_PREFIX}${eventId}`) ?? undefined,
    };
}

/** Write Canopy settings for a single event into localStorage. */
function hydrateEventSettings(eventId: string, settings: ICanopyEventSettings): void {
    const overlaysKey = overlaysKeyFor(eventId);
    const metaKey = metaKeyFor(eventId);

    if (overlaysKey && settings.overlays?.length) {
        writeLS(overlaysKey, normalizeOverlayArray(settings.overlays));
    }
    if (metaKey && settings.meta) {
        writeLS(metaKey, settings.meta);
    }
    if (settings.show_live != null) {
        writeLS(`${LS_SHOW_LIVE_PREFIX}${eventId}`, settings.show_live);
    }
    if (settings.resizer_sizes) {
        writeLS(`${LS_RESIZER_PREFIX}${eventId}`, settings.resizer_sizes);
    }
    if (settings.right_side_sizes) {
        writeLS(`${LS_RIGHT_SIDE_PREFIX}${eventId}`, settings.right_side_sizes);
    }
}

/** Scan localStorage for all Canopy event IDs that have stored overlays. */
function discoverLocalEventIds(): string[] {
    const ids = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(LS_OVERLAY_PREFIX)) {
            ids.add(key.slice(LS_OVERLAY_PREFIX.length));
        }
    }
    return Array.from(ids);
}

// ── hook ─────────────────────────────────────────────────────────────────────

export interface UseCanopySettingsSyncResult {
    /** Call on mount to hydrate localStorage from server. Returns last_event_id or null. */
    hydrate: () => Promise<string | null>;
    /** Call when the active event changes to push current state to server. */
    pushCurrentEvent: (eventId: string) => void;
}

export function useCanopySettingsSync(): UseCanopySettingsSyncResult {
    const user = useUser();
    const customerId = user?.id || (user as any)?.memberId;
    const memberService = useMemo(() => {
        try { return getService<IMemberService>('IMemberService'); } catch { return null; }
    }, []);

    const pushInFlight = useRef(false);

    /** Push current event's localStorage state + last_event_id to the server. */
    const pushCurrentEvent = useCallback(
        (eventId: string) => {
            if (!memberService || !customerId || !eventId || pushInFlight.current) return;
            pushInFlight.current = true;

            // Only sync the current event — syncing all events exceeds Stripe's 50-key metadata limit.
            const events: Record<string, ICanopyEventSettings> = {
                [eventId]: collectEventSettings(eventId),
            };

            const settings: IUserSiteSettings = {
                apps: {
                    canopy: {
                        last_event_id: eventId,
                        events,
                    },
                },
            };

            memberService
                .saveSiteSettings(customerId, settings)
                .catch((err: any) => console.warn('[CanopySettingsSync] push failed:', err))
                .finally(() => { pushInFlight.current = false; });
        },
        [memberService, customerId],
    );

    /** Hydrate localStorage from server settings. Returns last_event_id or null. */
    const hydrate = useCallback(async (): Promise<string | null> => {
        if (!memberService || !customerId) return null;

        // Only hydrate if localStorage has no saved current event
        const existingCurrent = readLS(LS_KEY_CURRENT);
        if (existingCurrent) return null;

        try {
            const raw = await memberService.getSiteSettings(customerId);
            if (!raw) return null;

            const settings: IUserSiteSettings = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const canopy = settings?.apps?.canopy;
            if (!canopy) return null;

            // Write all per-event settings into localStorage
            if (canopy.events) {
                for (const [eid, evtSettings] of Object.entries(canopy.events)) {
                    if (evtSettings) hydrateEventSettings(eid, evtSettings);
                }
            }

            // Write the last-event-id into LS_KEY_CURRENT
            if (canopy.last_event_id) {
                writeLS(LS_KEY_CURRENT, { id: canopy.last_event_id });
            }

            return canopy.last_event_id ?? null;
        } catch (err) {
            console.warn('[CanopySettingsSync] hydrate failed:', err);
            return null;
        }
    }, [memberService, customerId]);

    return { hydrate, pushCurrentEvent };
}
