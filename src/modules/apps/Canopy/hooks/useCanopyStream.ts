import { useCallback, useEffect, useRef, useState } from "react";

type StreamState = "idle" | "starting" | "live" | "stopping" | "offline" | "error";

type StreamStatus = {
    state: StreamState;
    message?: string;
    updatedAt?: string;
    sessionId?: string;
    previewUrl?: string | null;
    destination?: string;
    ingestUrl?: string;
    maskedStreamKey?: string;
    rtmpUrl?: string;
    rtmpUrlMasked?: string;
    rtmpHealthy?: boolean | null;
    rtmpCheckedAt?: string | null;
};

type CommandPayload = {
    streamKey?: string;
    preview?: boolean;
    eventName?: string;
    userInitiated?: boolean;
    sessionId?: string;
    config?: CanopyConfig;
};

type UseCanopyStreamArgs = {
    eventId?: string;
    userId?: string;
    pollMs?: number;
};

export type CanopyConfig = {
    outputs?: CanopyOutput[];
    bitrate?: string;
    maxrate?: string;
    bufsize?: string;
    frameRate?: number;
    keyint?: number;
    width?: number;
    height?: number;
    preset?: string;
    ingestUrl?: string;
    destination?: string;
    streamKey?: string;
    preview?: boolean;
    videoEncoder?: string;
    rateControl?: "cbr" | "vbr" | "crf" | "qp" | string;
    profile?: string;
    tune?: string;
    crf?: number;
    qp?: number;
    colorRange?: string;
    pixelFormat?: string;
    audioEncoder?: string;
    audioBitrate?: string;
    audioSampleRate?: number;
    audioChannels?: number;
    audioVolume?: number;
};

export type CanopyOutput = {
    service: string;
    ingestUrl?: string;
    streamKey?: string;
    enabled?: boolean;
};

export type CanopyEncoderOption = { value: string; label: string; note?: string; kind?: string };

export type CanopyCapabilities = {
    videoEncoders: CanopyEncoderOption[];
    audioEncoders: CanopyEncoderOption[];
    sampleRates: number[];
    audioChannels: number[];
    rateControls?: string[];
    pixelFormats?: string[];
    colorRanges?: string[];
    videoProfiles?: string[];
    videoTunes?: string[];
    videoPresets?: string[];
};

export const DEFAULT_CANOPY_CAPABILITIES: CanopyCapabilities = {
    videoEncoders: [
        { value: "h264_nvenc", label: "h264_nvenc (GPU)" },
        { value: "hevc_nvenc", label: "hevc_nvenc (GPU)" },
        { value: "h264_vaapi", label: "h264_vaapi (VAAPI)" },
        { value: "libx264", label: "libx264 (CPU)" },
    ],
    audioEncoders: [
        { value: "aac", label: "AAC" },
        { value: "libopus", label: "Opus" },
    ],
    sampleRates: [44100, 48000],
    audioChannels: [2],
    rateControls: ["cbr", "vbr", "crf", "qp"],
    pixelFormats: ["yuv420p", "nv12"],
    colorRanges: ["tv", "pc"],
    videoProfiles: ["main", "high"],
    videoTunes: ["hq", "ll", "llhq"],
    videoPresets: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
};

type ConfigPingResponse = {
    refreshedAt?: string;
};

type UseCanopyStreamReturn = {
    startStream: (data?: CommandPayload) => Promise<void>;
    stopStream: () => Promise<void>;
    requestPreview: () => Promise<void>;
    loadConfig: () => Promise<CanopyConfig>;
    saveConfig: (cfg: CanopyConfig) => Promise<CanopyConfig>;
    pingConfig: () => Promise<ConfigPingResponse>;
    loadCapabilities: () => Promise<CanopyCapabilities>;
    config: CanopyConfig | null;
    status: StreamStatus;
    busy: boolean;
    logs: string[];
    lastPreviewUrl: string | null;
    error: string | null;
    lastUpdated?: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
const withBase = (path: string) => `${API_BASE}${path}`;

const resolvePreviewUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return API_BASE ? `${API_BASE}${url}` : url;
};

const COMMAND_ENDPOINT = withBase("/streaming/canopy/command");
const STATUS_ENDPOINT = withBase("/streaming/canopy/status");
const PREVIEW_ENDPOINT = withBase("/streaming/canopy/preview");
const CONFIG_ENDPOINT = withBase("/streaming/canopy/config");
const CONFIG_PING_ENDPOINT = withBase("/streaming/canopy/config/ping");
const OPTIONS_ENDPOINT = withBase("/streaming/canopy/options");
const DEFAULT_POLL = 5_000;
const MAX_BACKOFF = 60_000;
const MAX_LOGS = 120;

const addQuery = (url: string, query: Record<string, string | number | undefined>) => {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
    });
    return u.toString();
};

export const useCanopyStream = ({ eventId, userId, pollMs = DEFAULT_POLL }: UseCanopyStreamArgs): UseCanopyStreamReturn => {
    const [status, setStatus] = useState<StreamStatus>({ state: "idle" });
    const [busy, setBusy] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [lastPreviewUrl, setLastPreviewUrl] = useState<string | null>(null);
    const [config, setConfig] = useState<CanopyConfig | null>(null);
    const configRef = useRef<CanopyConfig | null>(null);

    const applyConfig = useCallback((next: CanopyConfig) => {
        configRef.current = next;
        setConfig(next);
    }, []);

    const pollTimerRef = useRef<number | null>(null);
    const backoffRef = useRef<number>(pollMs);

    const pushLog = useCallback((entry: string) => {
        setLogs((prev) => [entry, ...prev].slice(0, MAX_LOGS));
    }, []);

    const fetchStatus = useCallback(async () => {
        if (!eventId || !userId) return;
        const url = addQuery(STATUS_ENDPOINT, { eventId, userId, t: Date.now() });
        const res = await fetch(url, { method: "GET" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Unable to load stream status");

        setStatus((prev) => ({
            state: (json?.state as StreamState) || prev.state || "idle",
            message: json?.message ?? prev.message,
            updatedAt: json?.updatedAt ?? prev.updatedAt,
            sessionId: json?.sessionId ?? prev.sessionId,
            previewUrl: json?.previewUrl ?? json?.frameUrl ?? prev.previewUrl ?? null,
            destination: json?.destination ?? prev.destination,
            ingestUrl: json?.ingestUrl ?? prev.ingestUrl,
            maskedStreamKey: json?.maskedStreamKey ?? prev.maskedStreamKey,
            rtmpUrl: json?.rtmpUrl ?? prev.rtmpUrl,
            rtmpUrlMasked: json?.rtmpUrlMasked ?? prev.rtmpUrlMasked,
            rtmpHealthy: json?.rtmpHealthy ?? prev.rtmpHealthy ?? null,
            rtmpCheckedAt: json?.rtmpCheckedAt ?? prev.rtmpCheckedAt ?? null,
        }));

        if (json?.previewUrl || json?.frameUrl) {
            const nextUrl = resolvePreviewUrl((json?.previewUrl ?? json?.frameUrl) as string);
            setLastPreviewUrl(nextUrl ? addQuery(nextUrl, { cb: Date.now() }) : null);
        }

        if (Array.isArray(json?.logs)) {
            const nextLogs = json.logs.map((l: any) => String(l));
            setLogs((prev) => [...nextLogs, ...prev].slice(0, MAX_LOGS));
        }

        if (json?.config && typeof json.config === "object" && !configRef.current) {
            applyConfig(json.config as CanopyConfig);
        }
    }, [eventId, userId, applyConfig]);

    const loadConfig = useCallback(async (): Promise<CanopyConfig> => {
        if (!eventId) throw new Error("Missing event context");
        const url = addQuery(CONFIG_ENDPOINT, { eventId, userId });
        const res = await fetch(url, { method: "GET" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Unable to load config");
        const cfg = (json?.config || {}) as CanopyConfig;
        applyConfig(cfg);
        return cfg;
    }, [applyConfig, eventId, userId]);

    const loadCapabilities = useCallback(async (): Promise<CanopyCapabilities> => {
        const url = addQuery(OPTIONS_ENDPOINT, { t: Date.now() });
        try {
            const res = await fetch(url, { method: "GET" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.message || "Unable to load encoder options");
            const caps: CanopyCapabilities = {
                ...DEFAULT_CANOPY_CAPABILITIES,
                ...(json?.capabilities || json || {}),
            };
            return caps;
        } catch (err) {
            return DEFAULT_CANOPY_CAPABILITIES;
        }
    }, []);

    const saveConfig = useCallback(async (cfg: CanopyConfig): Promise<CanopyConfig> => {
        if (!eventId) throw new Error("Missing event context");
        const url = addQuery(CONFIG_ENDPOINT, { eventId, userId });
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cfg),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Unable to save config");
        const nextCfg = (json?.config || cfg) as CanopyConfig;
        applyConfig(nextCfg);
        return nextCfg;
    }, [applyConfig, eventId, userId]);

    const pingConfig = useCallback(async (): Promise<ConfigPingResponse> => {
        if (!eventId) throw new Error("Missing event context");
        const url = addQuery(CONFIG_PING_ENDPOINT, { eventId, userId });
        const res = await fetch(url, { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Unable to ping config");
        return json as ConfigPingResponse;
    }, [eventId, userId]);

    const sendCommand = useCallback(
        async (action: "start" | "stop", data?: CommandPayload) => {
            if (!eventId || !userId) throw new Error("Missing event or user context");
            setBusy(true);
            setError(null);
            try {
                const { config, ...rest } = data || {};
                const res = await fetch(COMMAND_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action, eventId, userId, data: rest, config }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.message || `Command ${action} failed`);
                const msg = json?.message || `${action} requested`;
                pushLog(msg);
                setStatus((prev) => ({ ...prev, state: action === "start" ? "starting" : "stopping", message: msg }));
            } catch (e: any) {
                const msg = e?.message || "Request failed";
                setError(msg);
                setStatus((prev) => ({ ...prev, state: "error", message: msg }));
                pushLog(`error: ${msg}`);
                throw e;
            } finally {
                setBusy(false);
            }
        },
        [eventId, userId, pushLog]
    );

    const startStream = useCallback(async (data?: CommandPayload) => {
        const payload: CommandPayload = { userInitiated: true, ...(data || {}) };
        await sendCommand("start", payload);
        await fetchStatus();
    }, [sendCommand, fetchStatus]);

    const stopStream = useCallback(async () => {
        await sendCommand("stop", { userInitiated: true, sessionId: status.sessionId });
        await fetchStatus();
    }, [sendCommand, fetchStatus, status.sessionId]);

    const requestPreview = useCallback(async () => {
        if (!eventId || !userId) throw new Error("Missing event or user context");
        const url = addQuery(PREVIEW_ENDPOINT, { eventId, userId, t: Date.now() });
        const res = await fetch(url, { method: "GET" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Preview request failed");
        if (json?.config && typeof json.config === "object") {
            applyConfig(json.config as CanopyConfig);
        }
        const frameUrl = resolvePreviewUrl(json?.frameUrl || json?.previewUrl || url);
        setLastPreviewUrl(frameUrl ? addQuery(frameUrl, { cb: Date.now() }) : null);
        pushLog(json?.message || "preview refreshed");
    }, [eventId, userId, pushLog, applyConfig]);

    useEffect(() => {
        if (!eventId || !userId) return () => { };
        let cancelled = false;

        const tick = async () => {
            if (cancelled) return;
            try {
                await fetchStatus();
                backoffRef.current = pollMs;
            } catch (e: any) {
                const next = Math.min(backoffRef.current * 2, MAX_BACKOFF);
                backoffRef.current = next;
                pushLog(e?.message || "status poll failed");
            }
            if (cancelled) return;
            pollTimerRef.current = window.setTimeout(tick, backoffRef.current);
        };

        tick();

        return () => {
            cancelled = true;
            if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
            backoffRef.current = pollMs;
        };
    }, [eventId, userId, fetchStatus, pollMs, pushLog]);

    return {
        startStream,
        stopStream,
        requestPreview,
        loadConfig,
        saveConfig,
        pingConfig,
        loadCapabilities,
        config,
        status,
        busy,
        logs,
        lastPreviewUrl,
        error,
        lastUpdated: status.updatedAt ?? null,
    };
};

export type { CommandPayload, StreamStatus, UseCanopyStreamArgs, UseCanopyStreamReturn };
