import ApiService from "../ApiService";
import environment from "~/src/core/environment";

export type PipelineKind = "camera" | "screen" | "rtmp" | "pull";

export type PipelineSession = {
    id: string;
    kind?: PipelineKind;
    whipUrl: string;
    viewUrl: string;
    rtmpUrl?: string;
    hlsUrl?: string;
    streamKey?: string;
    status?: string;
    streamReady?: boolean;
    hlsReady?: boolean;
    meta?: Record<string, any>;
    lastHeartbeat?: string;
    createdAt?: string;
    label?: string;
    sessionToken?: string;
};

export type SessionStatus = {
    id: string;
    status: string;
    streamReady: boolean;
    hlsReady: boolean;
    playableHlsUrl?: string;
    activePublishers: number;
    activeReaders: number;
    bytesReceived: number;
    bytesSent: number;
    lastActivity?: string;
};

export type PipelineLogEntry = {
    ts: string;
    msg: string;
    level?: "info" | "warn" | "error" | "debug";
};

// Mounted under /streaming in main.py
const BASE_PATH = "/streaming/pipeline/sessions";

export default class PipelineService extends ApiService {
    constructor() {
        super(environment.serviceEndpoints.data || "");
    }

    /**
     * Create a new pipeline session (camera, screen, or rtmp)
     * For deterministic stream keys, pass userId, streamId (eventId), and overlayId
     */
    public async createSession(input: {
        kind: PipelineKind;
        label?: string;
        meta?: Record<string, any>;
        require_token?: boolean;
        userId?: string;
        streamId?: string;
        overlayId?: string;
    }): Promise<PipelineSession> {
        console.log('[PipelineService] createSession input:', JSON.stringify(input, null, 2));
        const created = await this.post<typeof input, PipelineSession>(BASE_PATH, input);
        console.log('[PipelineService] createSession response:', JSON.stringify(created, null, 2));
        return this.normalize(created);
    }

    /**
     * Create a pull session that ingests from an external URL (RTSP, HLS, etc.)
     */
    public async createPullSession(sourceUrl: string, label?: string): Promise<PipelineSession> {
        const created = await this.post<{ source_url: string; label?: string }, PipelineSession>(
            `${BASE_PATH}/pull`,
            { source_url: sourceUrl, label }
        );
        return this.normalize(created);
    }

    /**
     * List all active sessions for the current user
     */
    public async listSessions(options?: {
        status?: string;
        kind?: PipelineKind;
        limit?: number;
    }): Promise<PipelineSession[]> {
        const params = new URLSearchParams();
        if (options?.status) params.set("status", options.status);
        if (options?.kind) params.set("kind", options.kind);
        if (options?.limit) params.set("limit", options.limit.toString());

        const query = params.toString();
        const url = query ? `${BASE_PATH}?${query}` : BASE_PATH;
        const response = await this.get<{ sessions: PipelineSession[] } | PipelineSession[]>(url);

        // Handle both array and wrapped response
        const sessions = Array.isArray(response) ? response : (response?.sessions || []);
        return sessions.map((s) => this.normalize(s));
    }

    /**
     * Get session by ID
     */
    public async getSession(id: string): Promise<PipelineSession> {
        const session = await this.get<PipelineSession>(`${BASE_PATH}/${encodeURIComponent(id)}`);
        return this.normalize(session);
    }

    /**
     * Get real-time status from MediaMTX (stream ready, HLS ready, etc.)
     */
    public async getSessionStatus(id: string): Promise<SessionStatus> {
        const response = await this.get<{ session?: any; mediamtx?: any }>(`${BASE_PATH}/${encodeURIComponent(id)}/status`);
        const mtx = response?.mediamtx || {};
        const session = response?.session || {};

        return {
            id: session?.id || id,
            status: session?.status || "unknown",
            streamReady: mtx?.ready === true,
            hlsReady: mtx?.hlsReady === true || session?.hlsReady === true,
            playableHlsUrl: session?.playableHlsUrl || undefined,
            activePublishers: mtx?.source ? 1 : 0,
            activeReaders: mtx?.readers || 0,
            bytesReceived: mtx?.bytesReceived || 0,
            bytesSent: 0,
            lastActivity: session?.lastHeartbeat,
        };
    }

    /**
     * Send heartbeat to keep session alive
     */
    public async heartbeat(id: string): Promise<PipelineSession> {
        const session = await this.put<Record<string, never>, PipelineSession>(
            `${BASE_PATH}/${encodeURIComponent(id)}/heartbeat`,
            {}
        );
        return this.normalize(session);
    }

    /**
     * Update session metadata (label, etc.)
     */
    public async updateSession(id: string, updates: { label?: string; meta?: Record<string, any>; streamKey?: string }): Promise<PipelineSession> {
        const session = await this.put<typeof updates, PipelineSession>(
            `${BASE_PATH}/${encodeURIComponent(id)}`,
            updates
        );
        return this.normalize(session);
    }

    /**
     * End/stop a session
     */
    public async endSession(id: string): Promise<PipelineSession> {
        const session = await this.put<Record<string, never>, PipelineSession>(
            `${BASE_PATH}/${encodeURIComponent(id)}/end`,
            {}
        );
        return this.normalize(session);
    }

    /**
     * Get logs for a pipeline session (filtered from MediaMTX)
     */
    public async getSessionLogs(id: string, tail: number = 50): Promise<PipelineLogEntry[]> {
        const response = await this.get<{ sessionId: string; logs: PipelineLogEntry[]; timestamp: string }>(
            `${BASE_PATH}/${encodeURIComponent(id)}/logs?tail=${tail}`
        );
        return response?.logs || [];
    }

    /**
     * Validate a session token for playback authentication
     */
    public async validateToken(sessionId: string, token: string): Promise<{ valid: boolean; session?: PipelineSession }> {
        const result = await this.post<{ session_id: string; token: string }, { valid: boolean; session?: any }>(
            `${BASE_PATH}/validate-token`,
            { session_id: sessionId, token }
        );
        return {
            valid: result.valid,
            session: result.session ? this.normalize(result.session) : undefined,
        };
    }

    /**
     * Resolve a session token to its binder-mode metadata for the public
     * invite-link page. Returns only the fields the popup publisher needs.
     */
    public async resolveToken(token: string): Promise<{
        sessionId: string;
        kind: PipelineKind;
        overlayId?: string;
        eventId?: string;
        userId?: string;
        streamKey?: string;
        status?: string;
    }> {
        return await this.post<{ token: string }, {
            sessionId: string;
            kind: PipelineKind;
            overlayId?: string;
            eventId?: string;
            userId?: string;
            streamKey?: string;
            status?: string;
        }>("/streaming/pipeline/auth/resolve", { token });
    }

    private normalize(raw: any): PipelineSession {
        const sanitizePlaylist = (url?: string): string | undefined => {
            if (typeof url !== "string") return url;
            if (!url.includes("main_stream.m3u8")) return url;
            // Force new playlist name without losing any query params
            return url.replace(/main_stream\.m3u8/, "index.m3u8");
        };

        const id = raw?.id ?? raw?.session_id ?? "";
        const viewUrl = raw?.viewUrl ?? raw?.view_url ?? "";
        const meta = { ...(raw?.meta || {}) } as Record<string, any>;

        // Normalize HLS URLs returned from backend or persisted sessions
        for (const key of ["hlsUrl", "hls_url", "playbackUrl", "playback_url", "playlistUrl", "playlist_url"]) {
            const maybe = sanitizePlaylist(meta[key]);
            if (maybe) meta[key] = maybe;
        }

        // Extract HLS URL from meta or direct field
        const hlsCandidates = [
            raw?.hlsUrl,
            raw?.hls_url,
            meta?.hlsUrl,
            meta?.hls_url,
            meta?.playbackUrl,
            meta?.playback_url,
        ].filter(Boolean);
        const hlsUrl = sanitizePlaylist(hlsCandidates[0]) || undefined;

        // Handle RTMP URL (backend sends rtmpIngestUrl)
        const rtmpUrl = raw?.rtmpUrl ?? raw?.rtmp_url ?? raw?.rtmpIngestUrl ?? raw?.rtmp_ingest_url ?? "";

        return {
            id,
            kind: raw?.kind,
            whipUrl: raw?.whipUrl ?? raw?.whip_url ?? "",
            viewUrl: this.resolveViewUrl(viewUrl, id),
            rtmpUrl,
            hlsUrl,
            streamKey: raw?.streamKey ?? raw?.stream_key ?? meta?.streamKey ?? id,
            status: raw?.status,
            streamReady: raw?.isReceiving ?? raw?.is_receiving ?? raw?.stream_ready ?? raw?.streamReady ?? false,
            hlsReady: raw?.hls_ready ?? raw?.hlsReady ?? false,
            meta,
            lastHeartbeat: raw?.lastHeartbeat ?? raw?.last_heartbeat,
            createdAt: raw?.createdAt ?? raw?.created_at,
            label: raw?.label,
            sessionToken: raw?.sessionToken ?? raw?.session_token,
        } as PipelineSession;
    }

    private resolveViewUrl(viewUrl: string, sessionId: string): string {
        const backendBase = environment.serviceEndpoints?.data || "";
        const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
        const hasBackendBase = backendBase && viewUrl?.startsWith(backendBase);
        const isRelative = viewUrl?.startsWith("/");

        if (!origin) return viewUrl;

        if (!viewUrl || hasBackendBase || isRelative) {
            const url = new URL(viewUrl || "/pipeline", origin);
            if (!url.searchParams.get("streamId") && sessionId) {
                url.searchParams.set("streamId", sessionId);
            }
            return url.toString();
        }

        return viewUrl;
    }
}
