import { useCallback, useMemo, useState } from "react";
import environment from "~/src/core/environment";

export type CameraStatus =
    | "pending"
    | "connected"
    | "disconnected"
    | "revoked";

export type CameraSession = {
    id: string;
    label: string;
    room: string;
    status: CameraStatus;
    createdAt: number;
    expiresAt: number;
    guestUrl: string;
    viewUrl: string;
};

export type UseObscureCamerasResult = {
    baseUrl: string;
    sessions: CameraSession[];
    refreshing: boolean;
    creating: boolean;
    lastError: string | null;
    refreshSessions: () => Promise<void>;
    createSession: (input: {
        label: string;
        room?: string;
        ttlSeconds?: number;
    }) => Promise<CameraSession>;
    revokeSession: (id: string) => Promise<CameraSession>;
    updateStatus: (id: string, status: CameraStatus) => Promise<CameraSession>;
};

const trimTrailingSlash = (value?: string | null) => {
    if (!value) return "";
    return value.replace(/\/+$/, "");
};

const normalizeSession = (data: Record<string, any>): CameraSession => ({
    id: data.id,
    label: data.label,
    room: data.room,
    status: (data.status ?? "pending") as CameraStatus,
    createdAt: data.created_at ?? data.createdAt ?? Date.now(),
    expiresAt: data.expires_at ?? data.expiresAt ?? Date.now(),
    guestUrl: data.guest_url ?? data.guestUrl ?? "",
    viewUrl: data.view_url ?? data.viewUrl ?? "",
});

export const useObscureCameras = (): UseObscureCamerasResult => {
    const baseUrl = useMemo(() => {
        const envBase = trimTrailingSlash(environment?.serviceEndpoints?.home);
        if (envBase) return `${envBase}/obs`;
        if (typeof window !== "undefined" && window.location?.origin) {
            return `${trimTrailingSlash(window.location.origin)}/obs`;
        }
        return "/obs";
    }, []);

    const [sessions, setSessions] = useState<CameraSession[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    const request = useCallback(
        async <T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> => {
            const target = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
            const headers = new Headers(init?.headers || undefined);
            if (init?.body && !headers.has("Content-Type")) {
                headers.set("Content-Type", "application/json");
            }
            const response = await fetch(target, {
                method: init?.method ?? "GET",
                credentials: init?.credentials ?? "include",
                ...init,
                headers,
            });

            const text = await response.text();
            let payload: any = null;
            if (text) {
                try {
                    payload = JSON.parse(text);
                } catch {
                    payload = text;
                }
            }

            if (!response.ok) {
                const message =
                    typeof payload === "string"
                        ? payload
                        : payload?.detail || payload?.message || response.statusText;
                throw new Error(message || `Request failed (${response.status})`);
            }

            return (payload ?? {}) as T;
        },
        [baseUrl]
    );

    const refreshSessions = useCallback(async () => {
        setRefreshing(true);
        try {
            const data = await request<Record<string, any>>("/cameras");
            const items = Array.isArray(data?.items)
                ? (data.items as Record<string, any>[])
                : [];
            setSessions(items.map(normalizeSession));
            setLastError(null);
        } catch (error: any) {
            const message = error?.message ?? "Unable to load cameras.";
            setLastError(message);
            throw error;
        } finally {
            setRefreshing(false);
        }
    }, [request]);

    const createSession = useCallback(
        async (input: { label: string; room?: string; ttlSeconds?: number }) => {
            setCreating(true);
            try {
                const data = await request<Record<string, any>>("/cameras", {
                    method: "POST",
                    body: JSON.stringify({
                        label: input.label,
                        room: input.room,
                        ttl_seconds: input.ttlSeconds,
                    }),
                });
                const session = normalizeSession(data);
                setSessions((prev) => [session, ...prev]);
                setLastError(null);
                return session;
            } catch (error: any) {
                const message = error?.message ?? "Unable to create camera.";
                setLastError(message);
                throw error;
            } finally {
                setCreating(false);
            }
        },
        [request]
    );

    const revokeSession = useCallback(
        async (id: string) => {
            const data = await request<Record<string, any>>(`/cameras/${id}/revoke`, {
                method: "POST",
            });
            const session = normalizeSession(data);
            setSessions((prev) => prev.map((item) => (item.id === id ? session : item)));
            return session;
        },
        [request]
    );

    const updateStatus = useCallback(
        async (id: string, status: CameraStatus) => {
            const data = await request<Record<string, any>>(`/cameras/${id}/status`, {
                method: "POST",
                body: JSON.stringify({ status }),
            });
            const session = normalizeSession(data);
            setSessions((prev) => prev.map((item) => (item.id === id ? session : item)));
            return session;
        },
        [request]
    );

    return {
        baseUrl,
        sessions,
        refreshing,
        creating,
        lastError,
        refreshSessions,
        createSession,
        revokeSession,
        updateStatus,
    };
};
