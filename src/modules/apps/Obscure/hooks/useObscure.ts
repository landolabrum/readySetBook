import { useCallback, useMemo, useState } from "react";
import environment from "~/src/core/environment";

export type ObsHealthState = {
  status: string;
  obsWebSocketVersion?: string;
  obsVersion?: string;
  streamingActive?: boolean;
  streamingTimecode?: string;
  recordingActive?: boolean;
  recordingTimecode?: string;
  fetchedAt?: number;
};

export type ObsScene = {
  sceneName: string;
  sceneIndex?: number;
  sceneUuid?: string;
  isGroup?: boolean;
  [key: string]: unknown;
};

export type ObsScenesState = {
  currentProgramScene: string | null;
  currentPreviewScene: string | null;
  scenes: ObsScene[];
  fetchedAt?: number;
};

export type ObsSource = {
  sceneItemId: number;
  sceneItemIndex?: number;
  sceneItemEnabled?: boolean;
  sceneItemLocked?: boolean;
  sourceName?: string;
  inputKind?: string | null;
  sourceType?: string | null;
  [key: string]: unknown;
};

export type ObsSourcesState = {
  sceneName: string | null;
  items: ObsSource[];
  fetchedAt?: number;
};

export type ObsCommand =
  | "set_scene"
  | "stream_start"
  | "stream_stop"
  | "record_start"
  | "record_stop";

export type UseObscureResult = {
  baseUrl: string;
  health: ObsHealthState | null;
  scenes: ObsScenesState | null;
  sources: ObsSourcesState | null;
  currentProgramScene: string | null;
  currentPreviewScene: string | null;
  healthRefreshing: boolean;
  scenesRefreshing: boolean;
  sourcesRefreshing: boolean;
  actionInFlight: ObsCommand | null;
  lastError: string | null;
  refreshHealth: () => Promise<void>;
  refreshScenes: () => Promise<void>;
  refreshSources: (sceneName?: string) => Promise<void>;
  setSourceEnabled: (sceneName: string, sceneItemId: number, enabled: boolean) => Promise<void>;
  setSourceLocked: (sceneName: string, sceneItemId: number, locked: boolean) => Promise<void>;
  reorderSources: (sceneName: string, orderedSceneItemIds: number[]) => Promise<void>;
  setScene: (sceneName: string) => Promise<void>;
  startStream: () => Promise<void>;
  stopStream: () => Promise<void>;
  startRecord: () => Promise<void>;
  stopRecord: () => Promise<void>;
};

const trimTrailingSlash = (value?: string | null) => {
  if (!value) return "";
  return value.replace(/\/+$/, "");
};

const normalizeHealth = (data: Record<string, any>): ObsHealthState => ({
  status: data?.status ?? "unknown",
  obsWebSocketVersion: data?.obs_websocket_version ?? data?.obsWebSocketVersion,
  obsVersion: data?.obs_version ?? data?.obsVersion,
  streamingActive: Boolean(
    data?.streaming_active ?? data?.streamingActive ?? false
  ),
  streamingTimecode: data?.streaming_timecode ?? data?.streamingTimecode,
  recordingActive: Boolean(
    data?.recording_active ?? data?.recordingActive ?? false
  ),
  recordingTimecode: data?.recording_timecode ?? data?.recordingTimecode,
  fetchedAt: Date.now(),
});

const normalizeScenes = (data: Record<string, any>): ObsScenesState => ({
  currentProgramScene:
    data?.current_program_scene ?? data?.currentProgramScene ?? null,
  currentPreviewScene:
    data?.current_preview_scene ?? data?.currentPreviewScene ?? null,
  scenes: Array.isArray(data?.scenes) ? (data.scenes as ObsScene[]) : [],
  fetchedAt: Date.now(),
});

const normalizeSources = (data: Record<string, any>): ObsSourcesState => ({
  sceneName: data?.scene_name ?? data?.sceneName ?? null,
  items: Array.isArray(data?.scene_items ?? data?.sceneItems)
    ? ((data?.scene_items ?? data?.sceneItems) as ObsSource[])
    : [],
  fetchedAt: data?.fetched_at ?? data?.fetchedAt ?? Date.now(),
});

export const useObscure = (): UseObscureResult => {
  const baseUrl = useMemo(() => {
    const envBase = trimTrailingSlash(environment?.serviceEndpoints?.home);
    if (envBase) return `${envBase}/obs`;
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${trimTrailingSlash(window.location.origin)}/obs`;
    }
    return "/obs";
  }, []);

  const [health, setHealth] = useState<ObsHealthState | null>(null);
  const [scenes, setScenes] = useState<ObsScenesState | null>(null);
  const [sources, setSources] = useState<ObsSourcesState | null>(null);
  const [healthRefreshing, setHealthRefreshing] = useState(false);
  const [scenesRefreshing, setScenesRefreshing] = useState(false);
  const [sourcesRefreshing, setSourcesRefreshing] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<ObsCommand | null>(null);
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

  const refreshHealth = useCallback(async () => {
    setHealthRefreshing(true);
    try {
      const data = await request<Record<string, any>>("/health");
      setHealth(normalizeHealth(data));
      setLastError(null);
    } catch (error: any) {
      const message = error?.message ?? "Unable to reach OBS health.";
      setLastError(message);
      throw error;
    } finally {
      setHealthRefreshing(false);
    }
  }, [request]);

  const refreshScenes = useCallback(async () => {
    setScenesRefreshing(true);
    try {
      const data = await request<Record<string, any>>("/scenes");
      setScenes(normalizeScenes(data));
      setLastError(null);
    } catch (error: any) {
      const message = error?.message ?? "Unable to load scenes.";
      setLastError(message);
      throw error;
    } finally {
      setScenesRefreshing(false);
    }
  }, [request]);

  const refreshSources = useCallback(
    async (sceneName?: string) => {
      setSourcesRefreshing(true);
      try {
        const query = sceneName ? `?sceneName=${encodeURIComponent(sceneName)}` : "";
        const data = await request<Record<string, any>>(`/sources${query}`);
        setSources(normalizeSources(data));
        setLastError(null);
      } catch (error: any) {
        const message = error?.message ?? "Unable to load sources.";
        setLastError(message);
        throw error;
      } finally {
        setSourcesRefreshing(false);
      }
    },
    [request]
  );

  const setSourceEnabled = useCallback(
    async (sceneName: string, sceneItemId: number, enabled: boolean) => {
      if (!sceneName) throw new Error("Scene name is required.");
      await request(`/sources/${sceneItemId}/enabled`, {
        method: "POST",
        body: JSON.stringify({ sceneName, enabled }),
      });
      setLastError(null);
      await refreshSources(sceneName).catch(() => undefined);
    },
    [refreshSources, request]
  );

  const setSourceLocked = useCallback(
    async (sceneName: string, sceneItemId: number, locked: boolean) => {
      if (!sceneName) throw new Error("Scene name is required.");
      await request(`/sources/${sceneItemId}/locked`, {
        method: "POST",
        body: JSON.stringify({ sceneName, locked }),
      });
      setLastError(null);
      await refreshSources(sceneName).catch(() => undefined);
    },
    [refreshSources, request]
  );

  const reorderSources = useCallback(
    async (sceneName: string, orderedSceneItemIds: number[]) => {
      if (!sceneName) throw new Error("Scene name is required.");
      await request("/sources/reorder", {
        method: "POST",
        body: JSON.stringify({ sceneName, sceneItemIds: orderedSceneItemIds }),
      });
      setLastError(null);
      await refreshSources(sceneName).catch(() => undefined);
    },
    [refreshSources, request]
  );

  const setScene = useCallback(
    async (sceneName: string) => {
      if (!sceneName) throw new Error("Scene name is required.");
      setActionInFlight("set_scene");
      try {
        await request("/scene", {
          method: "POST",
          body: JSON.stringify({ sceneName }),
        });
        setLastError(null);
        await refreshScenes();
        await refreshSources(sceneName).catch(() => undefined);
      } catch (error: any) {
        const message = error?.message ?? "Unable to switch scenes.";
        setLastError(message);
        throw error;
      } finally {
        setActionInFlight(null);
      }
    },
    [refreshScenes, refreshSources, request]
  );

  const applyOptimisticHealth = useCallback(
    (action: ObsCommand) => {
      setHealth((previous) => {
        if (!previous) return previous;
        const updates: Partial<ObsHealthState> = {};

        if (action === "stream_start") {
          updates.streamingActive = true;
          updates.streamingTimecode = new Date().toISOString();
        } else if (action === "stream_stop") {
          updates.streamingActive = false;
        } else if (action === "record_start") {
          updates.recordingActive = true;
          updates.recordingTimecode = new Date().toISOString();
        } else if (action === "record_stop") {
          updates.recordingActive = false;
        }

        if (!Object.keys(updates).length) return previous;
        return { ...previous, ...updates };
      });
    },
    []
  );

  const runAction = useCallback(
    async (action: ObsCommand) => {
      const pathMap: Record<Exclude<ObsCommand, "set_scene">, string> = {
        stream_start: "/stream/start",
        stream_stop: "/stream/stop",
        record_start: "/record/start",
        record_stop: "/record/stop",
      };

      if (action === "set_scene") {
        throw new Error("Use setScene for scene switching");
      }

      setActionInFlight(action);
      try {
        await request(pathMap[action as Exclude<ObsCommand, "set_scene">], {
          method: "POST",
        });
        setLastError(null);
        applyOptimisticHealth(action);
        try {
          await refreshHealth();
        } catch (refreshError: any) {
          const message =
            refreshError?.message ?? "OBS command applied, but status refresh failed.";
          setLastError(message);
        }
      } catch (error: any) {
        const message = error?.message ?? "OBS command failed.";
        setLastError(message);
        throw error;
      } finally {
        setActionInFlight(null);
      }
    },
    [applyOptimisticHealth, refreshHealth, request]
  );

  const startStream = useCallback(() => runAction("stream_start"), [runAction]);
  const stopStream = useCallback(() => runAction("stream_stop"), [runAction]);
  const startRecord = useCallback(() => runAction("record_start"), [runAction]);
  const stopRecord = useCallback(() => runAction("record_stop"), [runAction]);

  return {
    baseUrl,
    health,
    scenes,
    sources,
    currentProgramScene: scenes?.currentProgramScene ?? null,
    currentPreviewScene: scenes?.currentPreviewScene ?? null,
    healthRefreshing,
    scenesRefreshing,
    sourcesRefreshing,
    actionInFlight,
    lastError,
    refreshHealth,
    refreshScenes,
    refreshSources,
    setSourceEnabled,
    setSourceLocked,
    reorderSources,
    setScene,
    startStream,
    stopStream,
    startRecord,
    stopRecord,
  };
};
