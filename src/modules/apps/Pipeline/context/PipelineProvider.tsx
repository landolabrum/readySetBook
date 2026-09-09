import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import PipelineService, { PipelineKind, PipelineSession, SessionStatus } from "~/src/core/services/PipelineService/PipelineService";
import { createWhipPublisher, PublishOptions, PublishState, WhipPublisher } from "../components/useWhipPublisher";
import useSessionStorage from "~/src/webstack/hooks/storage/useSessionStorage";

const HEARTBEAT_MS = 30_000;
const STATUS_POLL_MS = 8_000; // Poll MediaMTX status for RTMP/pull detection
const RESUME_TTL_MS = 300_000; // Match backend 5-minute TTL

type SessionEntry = {
    session: PipelineSession;
    stream: MediaStream | null;       // null for rtmp/pull (no local capture)
    publisher: WhipPublisher | null;  // null for rtmp/pull
    state: PublishState;
    error: string | null;
    lastPublish: { stream: MediaStream; options?: PublishOptions } | null;
};

type PipelineContextValue = {
    view: "main" | PipelineKind;
    setView: (next: "main" | PipelineKind) => void;
    resumableKind: PipelineKind | null;
    /** Active (focused) session — preserved for back-compat. May be null. */
    session: PipelineSession | null;
    /** All currently-tracked sessions (active backend status + locally-published). */
    sessions: PipelineSession[];
    /** Stream of the active session (back-compat). Prefer getStreamForSession. */
    stream: MediaStream | null;
    /** Per-session stream lookup — used by overlay renderers. */
    getStreamForSession: (sessionId: string | null | undefined) => MediaStream | null;
    /** Per-session publish state lookup. */
    getPublisherStateForSession: (sessionId: string | null | undefined) => PublishState;
    viewerUrl?: string;
    hlsUrl?: string;
    busy: boolean;
    error: string | null;
    publisherState: PublishState;
    publisherError: string | null;
    retryLastPublish: () => Promise<void>;
    statusLabel: string;
    streamStatus: SessionStatus | null;
    start: (kind: PipelineKind, stream: MediaStream, options?: PublishOptions & { userId?: string; streamId?: string; overlayId?: string }) => Promise<PipelineSession | null>;
    startRtmp: (label?: string, opts?: { userId?: string; streamId?: string; overlayId?: string }) => Promise<void>;
    startPull: (sourceUrl: string, label?: string) => Promise<PipelineSession | null>;
    stop: (sessionId?: string) => Promise<void>;
    updateStreamKey: (sessionId: string, newStreamKey: string) => Promise<PipelineSession | null>;
    getSession: (id: string) => Promise<PipelineSession | null>;
    listSessions: () => Promise<PipelineSession[]>;
    refreshStatus: () => Promise<void>;
    setActiveSession: (session: PipelineSession | null) => void;
};
const PipelineContext = createContext<PipelineContextValue | null>(null);

export const PipelineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const serviceRef = useRef(new PipelineService());
    const { setSessionItem, getSessionItem } = useSessionStorage();

    // Per-session entries (stream + publisher + state). Held in a ref so
    // publisher subscribers can mutate without re-renders, then bump() forces
    // a render when consumers need to see the change.
    const entriesRef = useRef<Map<string, SessionEntry>>(new Map());
    const [, bump] = useReducer((x: number) => x + 1, 0);

    const [view, setView] = useState<"main" | PipelineKind>("main");
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resumableKind, setResumableKind] = useState<PipelineKind | null>(null);
    const [streamStatus, setStreamStatus] = useState<SessionStatus | null>(null);

    // hydrate view from session storage
    useEffect(() => {
        const stored = getSessionItem("pipeline:view");
        const next = stored?.value;
        if (next === "camera" || next === "screen" || next === "rtmp" || next === "pull" || next === "main") {
            setView(next);
        }
    }, [getSessionItem]);

    // hydrate active session for up to RESUME_TTL_MS
    useEffect(() => {
        const stored = getSessionItem("pipeline:activeSession")?.value;
        const ts = stored?.ts as number | undefined;
        const saved: PipelineSession | undefined = stored?.session;
        if (!saved?.id || !ts) return;
        const age = Date.now() - ts;
        if (age > RESUME_TTL_MS) return;

        // Register the resumed session as a metadata-only entry (no stream/publisher).
        if (!entriesRef.current.has(saved.id)) {
            entriesRef.current.set(saved.id, {
                session: saved,
                stream: null,
                publisher: null,
                state: "idle",
                error: null,
                lastPublish: null,
            });
            bump();
        }
        setActiveSessionId(saved.id);
        if (saved.kind === "camera" || saved.kind === "screen" || saved.kind === "rtmp" || saved.kind === "pull") {
            setResumableKind(saved.kind);
            setView(saved.kind);
        }
    }, [getSessionItem]);

    // Load all active sessions on mount (metadata only — no local streams).
    useEffect(() => {
        serviceRef.current.listSessions({ status: "active" }).then((list) => {
            for (const s of list) {
                if (!entriesRef.current.has(s.id)) {
                    entriesRef.current.set(s.id, {
                        session: s,
                        stream: null,
                        publisher: null,
                        state: "idle",
                        error: null,
                        lastPublish: null,
                    });
                }
            }
            bump();
        }).catch(() => { });
    }, []);

    const setViewPersisted = useCallback(
        (next: "main" | PipelineKind) => {
            setView(next);
            setSessionItem("pipeline:view", { value: next });
        },
        [setSessionItem]
    );

    const persistActiveSession = useCallback(
        (s: PipelineSession | null) => {
            if (!s) {
                setSessionItem("pipeline:activeSession", { value: null });
                setResumableKind(null);
                return;
            }
            setSessionItem("pipeline:activeSession", { value: { session: s, ts: Date.now() } });
            if (s.kind === "camera" || s.kind === "screen" || s.kind === "rtmp" || s.kind === "pull") setResumableKind(s.kind);
        },
        [setSessionItem]
    );

    // Helpers to mutate entries
    const updateEntry = useCallback((id: string, patch: Partial<SessionEntry>) => {
        const cur = entriesRef.current.get(id);
        if (!cur) return;
        entriesRef.current.set(id, { ...cur, ...patch });
        bump();
    }, []);

    const removeEntry = useCallback((id: string) => {
        const cur = entriesRef.current.get(id);
        if (!cur) return;
        try { cur.publisher?.stop(); } catch { /* best-effort */ }
        try { cur.stream?.getTracks().forEach((t) => t.stop()); } catch { /* best-effort */ }
        entriesRef.current.delete(id);
        bump();
    }, []);

    // Derived: active session view
    const activeEntry = activeSessionId ? entriesRef.current.get(activeSessionId) ?? null : null;
    const session = activeEntry?.session ?? null;
    const stream = activeEntry?.stream ?? null;
    const publisherState: PublishState = activeEntry?.state ?? "idle";
    const publisherError: string | null = activeEntry?.error ?? null;

    const sessions: PipelineSession[] = useMemo(
        () => Array.from(entriesRef.current.values()).map((e) => e.session),
        // entriesRef mutates via bump(); subscribe to the same render trigger
        // by reading activeSessionId/publisherState which change together
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeSessionId, publisherState, publisherError]
    );

    const getStreamForSession = useCallback((sid: string | null | undefined): MediaStream | null => {
        if (!sid) return null;
        return entriesRef.current.get(sid)?.stream ?? null;
    }, []);

    const getPublisherStateForSession = useCallback((sid: string | null | undefined): PublishState => {
        if (!sid) return "idle";
        return entriesRef.current.get(sid)?.state ?? "idle";
    }, []);

    // Heartbeat for keeping ACTIVE session alive (back-compat behavior).
    useEffect(() => {
        if (!session) return undefined;
        const tick = async () => {
            const next = await serviceRef.current.heartbeat(session.id).catch(() => null);
            if (next?.id) {
                updateEntry(next.id, { session: next });
            }
        };
        const timer = setInterval(() => { tick(); }, HEARTBEAT_MS);
        return () => clearInterval(timer);
    }, [session, updateEntry]);

    // Poll for stream status (especially useful for RTMP to detect when encoder connects)
    useEffect(() => {
        if (!session) {
            setStreamStatus(null);
            return undefined;
        }

        let statusInFlight = false;
    const pollStatus = async () => {
            if (statusInFlight) return;
            statusInFlight = true;
            try {
                const status = await serviceRef.current.getSessionStatus(session.id);
                setStreamStatus(status);
                if (status.streamReady && !session.streamReady) {
                    const refreshed = await serviceRef.current.getSession(session.id);
                    if (refreshed?.id) {
                        updateEntry(refreshed.id, { session: refreshed });
                    }
                }
                // Propagate codec-aware playable URL from status poll into session so
                // useShareSession.resolvePlayableUrl can use it without waiting for a
                // full session refresh.
                if (status.playableHlsUrl && (session as any).playableHlsUrl !== status.playableHlsUrl) {
                    updateEntry(session.id, { session: { ...(session as any), playableHlsUrl: status.playableHlsUrl } });
                }
            } catch {
                // ignore
            } finally {
                statusInFlight = false;
            }
        };

        pollStatus();

        if (session.kind === "rtmp" || session.kind === "pull") {
            const timer = setInterval(pollStatus, STATUS_POLL_MS);
            return () => clearInterval(timer);
        }

        return undefined;
    }, [session, updateEntry]);

    const viewerUrl = useMemo(() => {
        if (!session?.id) return undefined;
        const base = typeof window !== "undefined" ? window.location.origin : "";
        if (!base) return `/pipeline?streamId=${encodeURIComponent(session.id)}`;
        return `${base}/pipeline?streamId=${encodeURIComponent(session.id)}`;
    }, [session?.id]);

    const hlsUrl = useMemo(() => {
        if (session?.hlsUrl) return session.hlsUrl;
        const meta = session?.meta || {};
        const candidates = [
            meta?.hlsUrl, meta?.hls_url, meta?.playbackUrl, meta?.playback_url,
            meta?.playlistUrl, meta?.playlist_url, meta?.viewUrl, meta?.view_url,
            session?.viewUrl,
        ].filter(Boolean) as string[];
        const found = candidates.find((u) => typeof u === "string" && u.includes(".m3u8"));
        return found ?? candidates[0];
    }, [session?.hlsUrl, session?.meta, session?.viewUrl]);

    const getSession = useCallback(async (id: string) => {
        try {
            return await serviceRef.current.getSession(id);
        } catch {
            return null;
        }
    }, []);

    const listSessions = useCallback(async () => {
        try {
            const fetched = await serviceRef.current.listSessions({ status: "active" });
            // Sync backend list into entries (metadata-only for ones we don't own locally)
            for (const s of fetched) {
                const existing = entriesRef.current.get(s.id);
                if (existing) {
                    entriesRef.current.set(s.id, { ...existing, session: s });
                } else {
                    entriesRef.current.set(s.id, {
                        session: s,
                        stream: null,
                        publisher: null,
                        state: "idle",
                        error: null,
                        lastPublish: null,
                    });
                }
            }
            bump();
            return fetched;
        } catch {
            return [];
        }
    }, []);

    const refreshStatus = useCallback(async () => {
        if (!session) return;
        try {
            const status = await serviceRef.current.getSessionStatus(session.id);
            setStreamStatus(status);
        } catch {
            // ignore
        }
    }, [session]);

    const setActiveSession = useCallback((s: PipelineSession | null) => {
        if (!s) {
            setActiveSessionId(null);
            return;
        }
        // Register if unknown (metadata-only — no stream/publisher).
        if (!entriesRef.current.has(s.id)) {
            entriesRef.current.set(s.id, {
                session: s,
                stream: null,
                publisher: null,
                state: "idle",
                error: null,
                lastPublish: null,
            });
            bump();
        } else {
            updateEntry(s.id, { session: s });
        }
        setActiveSessionId(s.id);
        persistActiveSession(s);
        if (s.kind) setViewPersisted(s.kind);
    }, [persistActiveSession, setViewPersisted, updateEntry]);

    const start = useCallback(
        async (kind: PipelineKind, mediaStream: MediaStream, options?: PublishOptions & { userId?: string; streamId?: string; overlayId?: string; label?: string; meta?: Record<string, any> }) => {
            setBusy(true);
            setError(null);
            try {
                const stored = getSessionItem("pipeline:activeSession")?.value;
                const ts = stored?.ts as number | undefined;
                const saved: PipelineSession | undefined = stored?.session;
                const age = ts ? Date.now() - ts : Number.MAX_SAFE_INTEGER;
                // Only resume RTMP sessions; screen/camera always go through createSession
                // so the backend refreshes meta (userId, streamId, overlayId) every time.
                const canResume = saved?.id && saved?.kind === kind && kind === 'rtmp' && age <= RESUME_TTL_MS;

                const target = canResume
                    ? await serviceRef.current.getSession(saved!.id).catch(() => undefined)
                    : undefined;

                const active = target?.id ? target : await serviceRef.current.createSession({
                    kind,
                    label: options?.label,
                    meta: options?.meta,
                    userId: options?.userId,
                    streamId: options?.streamId,
                    overlayId: options?.overlayId,
                });

                // Each session gets its own publisher — never reuse across sessions.
                const publisher = createWhipPublisher();
                const sessionId = active.id;
                publisher.subscribe((s, e) => {
                    const cur = entriesRef.current.get(sessionId);
                    if (!cur) return;
                    entriesRef.current.set(sessionId, { ...cur, state: s, error: e });
                    bump();
                });

                entriesRef.current.set(sessionId, {
                    session: active,
                    stream: mediaStream,
                    publisher,
                    state: "idle",
                    error: null,
                    lastPublish: { stream: mediaStream, options },
                });
                setActiveSessionId(sessionId);
                persistActiveSession(active);
                bump();

                await publisher.start(mediaStream, active.whipUrl, options);

                // Refresh session metadata (e.g., HLS URL) after publish
                const refreshed = await serviceRef.current.getSession(active.id).catch(() => null);
                if (refreshed?.id) {
                    updateEntry(refreshed.id, { session: refreshed });
                }
                setViewPersisted(kind);
                return refreshed ?? active;
            } catch (err: any) {
                setError(err?.message ?? "Unable to start stream");
                // Publisher.start() already emitted 'error'; leave the stream
                // alive so the user can retry without re-selecting the source.
                return null;
            } finally {
                setBusy(false);
            }
        },
        [getSessionItem, persistActiveSession, setViewPersisted, updateEntry]
    );

    const stop = useCallback(async (sessionId?: string) => {
        setBusy(true);
        const targetId = sessionId || activeSessionId;

        if (targetId) {
            // Tear down the publisher + stream for THIS session only.
            removeEntry(targetId);
            await serviceRef.current.endSession(targetId).catch(() => undefined);
        }

        if (!sessionId || sessionId === activeSessionId) {
            setActiveSessionId(null);
            persistActiveSession(null);
            setStreamStatus(null);
            setViewPersisted("main");
        }

        setBusy(false);
    }, [activeSessionId, persistActiveSession, removeEntry, setViewPersisted]);

    const startRtmp = useCallback(async (label?: string, opts?: { userId?: string; streamId?: string; overlayId?: string }) => {
        setBusy(true);
        setError(null);
        try {
            const active = await serviceRef.current.createSession({
                kind: "rtmp",
                label,
                userId: opts?.userId,
                streamId: opts?.streamId,
                overlayId: opts?.overlayId,
            });
            entriesRef.current.set(active.id, {
                session: active,
                stream: null,
                publisher: null,
                state: "idle",
                error: null,
                lastPublish: null,
            });
            setActiveSessionId(active.id);
            persistActiveSession(active);
            bump();
            setViewPersisted("rtmp");
        } catch (err: any) {
            setError(err?.message ?? "Unable to create RTMP session");
        } finally {
            setBusy(false);
        }
    }, [persistActiveSession, setViewPersisted]);

    const startPull = useCallback(async (sourceUrl: string, label?: string): Promise<PipelineSession | null> => {
        setBusy(true);
        setError(null);
        try {
            const active = await serviceRef.current.createPullSession(sourceUrl, label);
            entriesRef.current.set(active.id, {
                session: active,
                stream: null,
                publisher: null,
                state: "idle",
                error: null,
                lastPublish: null,
            });
            setActiveSessionId(active.id);
            persistActiveSession(active);
            bump();
            setViewPersisted("pull");
            return active;
        } catch (err: any) {
            setError(err?.message ?? "Unable to create pull session");
            return null;
        } finally {
            setBusy(false);
        }
    }, [persistActiveSession, setViewPersisted]);

    const updateStreamKey = useCallback(async (sessionId: string, newStreamKey: string): Promise<PipelineSession | null> => {
        setBusy(true);
        setError(null);
        try {
            const updated = await serviceRef.current.updateSession(sessionId, { streamKey: newStreamKey });
            if (updated?.id) {
                updateEntry(updated.id, { session: updated });
                if (updated.id === activeSessionId) persistActiveSession(updated);
                return updated;
            }
            return null;
        } catch (err: any) {
            setError(err?.message ?? "Failed to update stream key");
            return null;
        } finally {
            setBusy(false);
        }
    }, [activeSessionId, persistActiveSession, updateEntry]);

    const retryLastPublish = useCallback(async () => {
        if (!activeEntry || !activeEntry.lastPublish || !activeEntry.publisher) return;
        const { stream: lastStream, options: lastOptions } = activeEntry.lastPublish;
        setBusy(true);
        try {
            activeEntry.publisher.stop();
            await activeEntry.publisher.start(lastStream, activeEntry.session.whipUrl, lastOptions);
            setError(null);
        } catch (err: any) {
            setError(err?.message ?? "Retry failed");
        } finally {
            setBusy(false);
        }
    }, [activeEntry]);

    const statusLabel = useMemo(() => {
        if (busy) return "Working...";

        if (session?.kind === "rtmp") {
            if (streamStatus?.streamReady) return "🟢 Stream Detected - Live";
            if (session?.status === "active") return "⏳ Waiting for encoder...";
            return "Idle";
        }

        if (session?.kind === "pull") {
            if (streamStatus?.streamReady) return "🟢 Pulling - Live";
            if (session?.status === "active") return "⏳ Connecting to source...";
            return "Idle";
        }

        if (publisherState === "live") return "🟢 Live";
        if (publisherState === "publishing") return "Publishing...";
        if (publisherError) return publisherError;
        if (error) return `⚠️ ${error}`;
        return "Idle";
    }, [busy, error, publisherError, publisherState, session?.kind, session?.status, streamStatus?.streamReady]);

    const value: PipelineContextValue = {
        view,
        setView: setViewPersisted,
        resumableKind,
        session,
        sessions,
        stream,
        getStreamForSession,
        getPublisherStateForSession,
        viewerUrl,
        hlsUrl,
        busy,
        error,
        publisherState,
        publisherError,
        retryLastPublish,
        statusLabel,
        streamStatus,
        start,
        startRtmp,
        startPull,
        stop,
        updateStreamKey,
        getSession,
        listSessions,
        refreshStatus,
        setActiveSession,
    };

    return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
};

export const usePipeline = (): PipelineContextValue => {
    const ctx = useContext(PipelineContext);
    if (!ctx) throw new Error("usePipeline must be used within a PipelineProvider");
    return ctx;
};
