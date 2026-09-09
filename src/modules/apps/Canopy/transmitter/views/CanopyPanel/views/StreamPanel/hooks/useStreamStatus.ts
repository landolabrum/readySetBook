import React from "react";
import IMemberService, { IUserStream } from "~/src/core/services/MemberService/IMemberService";
import environment from "~/src/core/environment";
import { getStreamCompositeKey } from "../functions/streamFieldBuilders";

type Status = "disabled" | "spinning" | "running" | "live" | "stale" | "error";

const HEARTBEAT_FRESH_MS = 120_000;
/** Fallback polling interval when SSE is unavailable. */
const POLL_FALLBACK_MS = 45_000;
/** How many consecutive SSE errors before falling back to polling. */
const SSE_ERROR_THRESHOLD = 10;

const isContainerNoise = (msg?: string): boolean => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes("bus.cc")
        || lower.includes("object_proxy.cc")
        || lower.includes("core-util.c")
        || lower.includes("authkey.c")
        || lower.includes("server-lookup.c")
        || lower.includes("dbus-launch")
        || lower.includes("failed to connect to the bus")
        || lower.includes("failed to connect to socket /run/dbus")
        || lower.includes("unknown address type")
        || lower.includes("registration response error message")
        || lower.includes("failed to log in to gcm")
        || lower.includes("deprecated_endpoint")
        || lower.includes("phone_registration_error");
};

const hasErrorLog = (stream: IUserStream): boolean => {
    if (!Array.isArray(stream.logTail) || stream.logTail.length === 0) return false;
    // Check the last few meaningful log lines (not just the very last)
    const tail = stream.logTail.slice(-5);
    for (const entry of tail) {
        const msg: string = (entry && ((entry as any).msg || (entry as any).message || entry)) as any;
        if (!msg || typeof msg !== "string") continue;
        if (isContainerNoise(msg)) continue;
        const lower = msg.toLowerCase();
        if (lower.includes("exiting") || lower.includes("start failed") || lower.includes("restart failed")) {
            return true;
        }
    }
    return false;
};

const hasRuntimeError = (stream: IUserStream): boolean => {
    if (!stream) return false;
    if (stream.runtimeError) return true;
    const hints = stream.runtimeHints;
    if (!hints) return false;
    if (hints.gpuRequired && hints.gpuAvailable === false) return true;
    return false;
};

/**
 * Key streams by composite key (PROVIDER-streamKey) to support multiple streams per provider.
 */
const toMap = (rows: IUserStream[] = []) =>
    rows.reduce((acc, row) => {
        if (row) {
            const key = getStreamCompositeKey(row);
            acc[key] = row;
        }
        return acc;
    }, {} as Record<string, IUserStream>);

const computeStatus = (stream: IUserStream): Status => {
    if (!stream.enabled) return "disabled";
    if (hasRuntimeError(stream) || hasErrorLog(stream)) return "error";

    // Backend now emits a truthful phase: spinning | running | live | error.
    // `running` = container confirmed up; `live` = ffmpeg actually delivering
    // the RTMP feed. Honor it directly, refined by heartbeat freshness, rather
    // than inferring "live" from a bare "running" (which masked crash-loops).
    const backend = stream.status;
    const stamp = stream.lastHeartbeat ? Date.parse(stream.lastHeartbeat) : NaN;
    const fresh = Number.isFinite(stamp) && (Date.now() - stamp) <= HEARTBEAT_FRESH_MS;

    if (backend === "error") return "error";
    if (backend === "spinning") return "spinning";
    if (backend === "live") return fresh || !Number.isFinite(stamp) ? "live" : "stale";
    if (backend === "running") return fresh || !Number.isFinite(stamp) ? "running" : "stale";

    // Legacy/fallback when the backend supplied no rich phase.
    if (Number.isFinite(stamp)) return fresh ? "live" : "stale";
    return "spinning";
};

export const useStreamStatus = (
    memberService: IMemberService,
    eventId?: string | null,
    userId?: string | null,
) => {
    const [userStreams, setUserStreams] = React.useState<Record<string, IUserStream>>({});
    const [loading, setLoading] = React.useState<boolean>(false);
    const [statusMap, setStatusMap] = React.useState<Record<string, Status>>({});

    const streamsRef = React.useRef<Record<string, IUserStream>>({});
    const statusRef = React.useRef<Record<string, Status>>({});
    const firstLoadRef = React.useRef<boolean>(false);

    const streamsEqual = (a?: IUserStream, b?: IUserStream) => {
        if (a === b) return true;
        if (!a || !b) return false;
        return (
            a.id === b.id &&
            a.provider === b.provider &&
            a.userHandle === b.userHandle &&
            a.enabled === b.enabled &&
            a.status === b.status &&
            a.serverUrl === b.serverUrl &&
            a.streamKey === b.streamKey &&
            a.lastHeartbeat === b.lastHeartbeat &&
            a.hlsUrl === b.hlsUrl &&
            a.hlsResolvedAt === b.hlsResolvedAt &&
            a.eventId === b.eventId &&
            a.userId === b.userId
        );
    };

    const refreshStreams = React.useCallback(
        async (isBackground = false) => {
            if (!eventId) {
                setUserStreams({});
                setStatusMap({});
                streamsRef.current = {};
                statusRef.current = {};
                return;
            }

            const shouldShowLoading = !isBackground;
            if (shouldShowLoading) setLoading(true);
            try {
                const res = await memberService.listUserStreams(eventId, userId || undefined);
                const streams = res?.streams || [];

                const prevStreams = streamsRef.current;
                const prevStatus = statusRef.current;

                const nextStreams: Record<string, IUserStream> = {};
                let streamsChanged = false;

                for (const stream of streams) {
                    const key = getStreamCompositeKey(stream);
                    const prev = prevStreams[key];
                    nextStreams[key] = streamsEqual(prev, stream) ? prev : stream;
                    if (!streamsEqual(prev, stream)) streamsChanged = true;
                }

                // Detect removals
                if (Object.keys(prevStreams).length !== streams.length) {
                    streamsChanged = true;
                }

                // Compute status map and diff
                const nextStatusEntries = Object.entries(nextStreams).map(([key, s]) => [key, computeStatus(s)] as const);
                const nextStatusMap = Object.fromEntries(nextStatusEntries) as Record<string, Status>;
                let statusChanged = Object.keys(prevStatus).length !== nextStatusEntries.length;
                if (!statusChanged) {
                    for (const [key, status] of nextStatusEntries) {
                        if (prevStatus[key] !== status) {
                            statusChanged = true;
                            break;
                        }
                    }
                }

                streamsRef.current = nextStreams;
                statusRef.current = nextStatusMap;

                if (streamsChanged) setUserStreams(nextStreams);
                if (statusChanged) setStatusMap(nextStatusMap);
                firstLoadRef.current = true;
            } catch (err) {
                // Preserve the last known good state on errors to avoid UI flicker/disappear
                // when transient fetch issues occur.
                return;
            } finally {
                if (shouldShowLoading) setLoading(false);
            }
        },
        [memberService, eventId, userId],
    );

    React.useEffect(() => {
        if (!eventId) return;
        let mounted = true;
        let es: EventSource | null = null;
        let fallbackTimer: number | undefined;
        let errorCount = 0;

        const applyStreams = (streams: IUserStream[]) => {
            if (!mounted) return;
            const prevStreams = streamsRef.current;
            const prevStatus = statusRef.current;

            const nextStreams: Record<string, IUserStream> = {};
            let streamsChanged = false;

            for (const stream of streams) {
                const key = getStreamCompositeKey(stream);
                const prev = prevStreams[key];
                nextStreams[key] = streamsEqual(prev, stream) ? prev : stream;
                if (!streamsEqual(prev, stream)) streamsChanged = true;
            }
            if (Object.keys(prevStreams).length !== streams.length) {
                streamsChanged = true;
            }

            const nextStatusEntries = Object.entries(nextStreams).map(([key, s]) => [key, computeStatus(s)] as const);
            const nextStatusMap = Object.fromEntries(nextStatusEntries) as Record<string, Status>;
            let statusChanged = Object.keys(prevStatus).length !== nextStatusEntries.length;
            if (!statusChanged) {
                for (const [key, status] of nextStatusEntries) {
                    if (prevStatus[key] !== status) { statusChanged = true; break; }
                }
            }

            streamsRef.current = nextStreams;
            statusRef.current = nextStatusMap;
            if (streamsChanged) setUserStreams(nextStreams);
            if (statusChanged) setStatusMap(nextStatusMap);
            firstLoadRef.current = true;
        };

        const startSSE = () => {
            if (!mounted) return;
            const base = (environment?.serviceEndpoints?.membership || '').replace(/\/+$/, '');
            const url = `${base}/streaming/user-streams/stream?event_id=${encodeURIComponent(eventId)}`;
            es = new EventSource(url);

            es.addEventListener('streams', (evt: MessageEvent) => {
                errorCount = 0;
                try {
                    const data = JSON.parse(evt.data);
                    if (Array.isArray(data?.streams)) {
                        applyStreams(data.streams);
                    }
                } catch { /* malformed SSE data */ }
            });

            es.onerror = () => {
                errorCount++;
                if (errorCount >= SSE_ERROR_THRESHOLD && mounted) {
                    // SSE is failing — close and fall back to polling
                    es?.close();
                    es = null;
                    startFallbackPolling();
                }
            };
        };

        const startFallbackPolling = () => {
            if (!mounted) return;
            async function tick() {
                if (!mounted) return;
                await refreshStreams(true);
                if (!mounted) return;
                fallbackTimer = window.setTimeout(tick, POLL_FALLBACK_MS);
            }
            tick();
        };

        // Initial fetch + start SSE
        refreshStreams(false).then(() => {
            if (mounted) startSSE();
        });

        return () => {
            mounted = false;
            es?.close();
            if (fallbackTimer) window.clearTimeout(fallbackTimer);
        };
    }, [eventId, refreshStreams]);

    return { userStreams, loadingUserStreams: loading, statusMap, refreshStreams } as const;
};

export type StreamStatus = Status;