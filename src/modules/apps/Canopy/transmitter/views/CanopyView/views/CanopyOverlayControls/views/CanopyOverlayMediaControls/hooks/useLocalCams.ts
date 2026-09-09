import { useCallback, useEffect, useMemo, useState } from 'react';
import { getService } from '@webstack/common';
import ISurveillanceService from '~/src/core/services/SurveillanceService/ISurveillanceService';
import useSessionStorage from '@webstack/hooks/storage/useSessionStorage';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';
import { normalizeSegments, defaultMediaSegment } from '@Canopy/models/canopyOverlayTypes';
import type { MediaSegment } from '@Canopy/models/canopyOverlayTypes';

interface UseLocalCamsOptions {
    overlay: CanonOverlay;
    onChange: (e: any) => void;
}

export type CamUrlKind = 'rtsp' | 'hls';

export type CamHealth = 'online' | 'offline' | 'unknown';

export interface LocalCam {
    name: string;
    model: string;
    status: string;
    ptz: string;
    hasPtz: boolean;
    rtspUrl: string;
    hlsUrl: string;
    /** Raw rtsp:// URL reported by the owning wyze-bridge (or the DB row for
     *  custom cams) — for consumers that ingest RTSP directly (MediaMTX etc.)
     *  instead of the server's MJPEG/HLS proxies. */
    wbRtspUrl?: string;
    /** host_key of the wyze-bridge device serving this cam (mb1-pi5-1 / xi1-pi5-1). */
    bridge?: string;
    /** Default `url` (kept for backward compatibility) — points at the HLS variant which carries audio. */
    url: string;
    id: string;
    /** Live health from `/stream/hls.status`. Distinct from `status` (which is
     *  the wyze-bridge `connected` field at list-load time) so the sidebar
     *  can show whether HLS is actually serving frames right now. */
    health: CamHealth;
    /** Optional human-readable reason from the status endpoint, e.g.
     *  `mediamtx_not_ready_and_no_wyze_bridge_match`. Used as a tooltip. */
    healthReason?: string;
    /** ms epoch of the last health probe, for debugging stale data. */
    healthCheckedAt?: number;
    _raw: any;
}

/**
 * Fetches, normalizes, and caches local Wyze-bridge cameras.
 * Provides helpers for picking individual cameras or adding all at once.
 */
export function useLocalCams({ overlay, onChange }: UseLocalCamsOptions) {
    const [localCams, setLocalCams] = useState<LocalCam[]>([]);
    const [camsLoading, setCamsLoading] = useState(false);
    const [selectedCam, setSelectedCam] = useState<LocalCam | null>(null);

    const surveillance = useMemo(() => getService<ISurveillanceService>('ISurveillanceService'), []);
    const { getSessionItem, setSessionItem } = useSessionStorage();

    // ---- Normalize raw camera payloads ----
    const normalizeCams = useCallback((payload: any): LocalCam[] => {
        const camsObj = payload?.cameras ?? payload ?? {};
        const list = Array.isArray(camsObj) ? camsObj : Object.values(camsObj);
        return list
            .filter((cam: any) => cam && cam.enabled !== false)
            .map((cam: any) => {
                const id = cam?.name_uri || cam?.id || cam?.nickname;
                if (!id) return null;
                const rtspUrl = surveillance.streamUrl(id, 'rtsp');
                const hlsUrl = surveillance.streamUrl(id, 'hls');
                return {
                    name: cam?.nickname || cam?.name_uri || cam?.id,
                    model: cam?.model_name || cam?.product_model || 'camera',
                    status: cam?.connected ? 'online' : 'offline',
                    ptz: cam?.ptz_position ? 'PTZ' : '',
                    hasPtz: Boolean(cam?.ptz_position),
                    rtspUrl,
                    hlsUrl,
                    wbRtspUrl: cam?.rtsp_url || undefined,
                    bridge: cam?.bridge || undefined,
                    url: hlsUrl,
                    id,
                    health: 'unknown' as CamHealth,
                    _raw: cam,
                };
            })
            .filter(Boolean) as LocalCam[];
    }, [surveillance]);

    // ---- Fetch cameras from API (or use session cache) ----
    const fetchCams = useCallback(async () => {
        try {
            setCamsLoading(true);
            const body = await surveillance.listCameras();
            const rows = normalizeCams(body);
            setLocalCams(rows);
            setSessionItem('localCams', { rows });
        } catch (err) {
            console.error('Failed to load local cams', err);
        } finally {
            setCamsLoading(false);
        }
    }, [surveillance, normalizeCams, setSessionItem]);

    useEffect(() => {
        const cached = getSessionItem('localCams');
        const cachedRows = cached?.value?.rows;
        if (Array.isArray(cachedRows) && cachedRows.length) {
            setLocalCams(cachedRows);
        }
        void fetchCams();
    }, [fetchCams, getSessionItem]);

    // ---- Health polling: every 15s, hit `/stream/hls.status?id=<id>` for each
    // cam and update the row's `health` so the sidebar can show 🟢/🔴/🟡 dots.
    // The server-side endpoint is cached (30s TTL) so this is cheap even with
    // 15+ cams. Skipped entirely if the cam list is empty. We key the effect
    // on the comma-joined id list so swapping a cam (same count, different
    // ids) restarts the poll; pure health updates from the probe itself
    // don't change the key, so we don't loop.
    const camIdsKey = useMemo(() => localCams.map((c) => c.id).filter(Boolean).sort().join(','), [localCams]);
    useEffect(() => {
        if (!camIdsKey) return undefined;
        const ids = camIdsKey.split(',');
        let cancelled = false;
        const probe = async () => {
            const results = await Promise.all(
                ids.map(async (id) => {
                    try {
                        const data = await surveillance.hlsStatus(id);
                        return {
                            id,
                            health: (data?.ready ? 'online' : 'offline') as CamHealth,
                            reason: typeof data?.reason === 'string' ? data.reason : undefined,
                        };
                    } catch {
                        return { id, health: 'unknown' as CamHealth, reason: 'network_error' };
                    }
                })
            );
            if (cancelled) return;
            const byId = new Map(results.map((r) => [r.id, r]));
            const ts = Date.now();
            setLocalCams((prev) => prev.map((cam) => {
                const r = byId.get(cam.id);
                if (!r) return cam;
                if (cam.health === r.health && cam.healthReason === r.reason) return cam;
                return { ...cam, health: r.health, healthReason: r.reason, healthCheckedAt: ts };
            }));
        };
        void probe();
        const interval = window.setInterval(probe, 15000);
        const onVisibility = () => { if (!document.hidden) void probe(); };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [camIdsKey, surveillance]);

    // ---- Helpers: work with segments array instead of flat urls ----
    const currentSegments = (): MediaSegment[] => normalizeSegments((overlay as any)?.data);

    const pushSegments = useCallback(
        (next: MediaSegment[]) => {
            onChange({ target: { name: 'data.segments', value: next } });
            onChange({ target: { name: 'data.urls', value: next.map((s) => s.url).filter(Boolean) } });
        },
        [onChange],
    );

    const handleCamPick = useCallback(
        (row: any, kind: CamUrlKind = 'hls') => {
            const pickedUrl = row?.[`${kind}Url`] || (kind === 'rtsp' ? row?.rtspUrl : row?.hlsUrl) || row?.url;
            if (!pickedUrl) return;
            const segs = currentSegments();
            if (!segs.some((s) => s.url === pickedUrl)) {
                pushSegments([...segs, defaultMediaSegment(pickedUrl)]);
            }
            setSelectedCam(row);
        },
        [overlay, onChange, pushSegments],
    );

    const addAllCams = useCallback(
        (kind: CamUrlKind = 'hls') => {
            const segs = currentSegments();
            const existingUrls = new Set(segs.map((s) => s.url));
            let added = 0;
            const next = [...segs];
            localCams.forEach((cam) => {
                const camUrl = kind === 'rtsp' ? cam?.rtspUrl : cam?.hlsUrl;
                if (camUrl && !existingUrls.has(camUrl)) {
                    next.push(defaultMediaSegment(camUrl));
                    added += 1;
                }
            });
            if (added > 0) pushSegments(next);
        },
        [overlay, onChange, localCams, pushSegments],
    );

    return { localCams, camsLoading, selectedCam, handleCamPick, addAllCams, fetchCams } as const;
}
