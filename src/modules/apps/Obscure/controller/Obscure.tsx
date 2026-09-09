import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./Obscure.scss";
import { useNotification } from "@webstack/components/Notification/Notification";
import useLayout from "@webstack/layouts/default/hooks/useLayout";
import { useObscure, ObsScene } from "../hooks/useObscure";
import { useObscureCameras } from "../hooks/useObscureCameras";
import ObscureHero from "../components/ObscureHero";
import StatusTiles from "../components/StatusTiles";
import TransportPanel from "../components/TransportPanel";
import SourcesPanel from "../components/SourcesPanel";
import { StatusTile, SourceRow } from "../components/types";
import { formatTime } from "../utils/time";
import ScenesPanel from "../components/ScenesPanel";
import CameraPanel from "../components/CameraPanel";

const Obscure: React.FC = () => {
    const [, setNotification] = useNotification();
    const { layout, setLayout } = useLayout();
    const {
        health,
        scenes,
        sources,
        currentProgramScene,
        currentPreviewScene,
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
    } = useObscure();
    const {
        sessions,
        refreshing: camerasRefreshing,
        creating: camerasCreating,
        lastError: camerasError,
        refreshSessions,
        createSession,
        revokeSession,
    } = useObscureCameras();
    const [selectedScene, setSelectedScene] = useState<string | null>(null);
    const streamingActive = health?.streamingActive ?? false;
    const recordingActive = health?.recordingActive ?? false;
    const streamActionBusy =
        actionInFlight === "stream_start" || actionInFlight === "stream_stop";
    const recordActionBusy =
        actionInFlight === "record_start" || actionInFlight === "record_stop";
    const transportsDisabled = Boolean(actionInFlight);

    useEffect(() => {
        if (!layout?.background || layout.background === "") {
            setLayout?.({ background: "#050910" });
        }
    }, [layout?.background, setLayout]);

    const toast = useCallback(
        (label: string, message?: string) => {
            setNotification({
                active: true,
                persistence: 3200,
                dismissable: true,
                list: [{ label, ...(message ? { message } : {}) }],
            });
        },
        [setNotification]
    );

    useEffect(() => {
        let cancelled = false;
        const bootstrap = async () => {
            try {
                await Promise.all([
                    refreshHealth(),
                    refreshScenes(),
                    refreshSources(),
                ]);
            } catch (error: any) {
                if (cancelled) return;
                toast("OBS unreachable", error?.message ?? "Unable to reach the OBS bridge.");
            }
        };
        bootstrap();
        return () => {
            cancelled = true;
        };
    }, [refreshHealth, refreshScenes, refreshSources, toast]);

    useEffect(() => {
        let cancelled = false;
        const bootstrapCameras = async () => {
            try {
                await refreshSessions();
            } catch (error: any) {
                if (cancelled) return;
                toast("Camera sync failed", error?.message ?? "Unable to fetch camera links.");
            }
        };
        bootstrapCameras();
        return () => {
            cancelled = true;
        };
    }, [refreshSessions, toast]);

    const sceneList = useMemo<ObsScene[]>(
        () => scenes?.scenes ?? [],
        [scenes]
    );

    useEffect(() => {
        if (!sceneList.length) return;
        setSelectedScene((prev) => {
            if (prev && sceneList.some((scene) => scene.sceneName === prev)) {
                return prev;
            }
            return currentProgramScene ?? sceneList[0]?.sceneName ?? null;
        });
    }, [sceneList, currentProgramScene]);

    const handleSceneSelect = useCallback((sceneName: string) => {
        setSelectedScene(sceneName);
    }, []);

    useEffect(() => {
        if (!selectedScene) return;
        if (sources?.sceneName === selectedScene) return;
        refreshSources(selectedScene).catch(() => undefined);
    }, [selectedScene, sources?.sceneName, refreshSources]);

    const commitScene = useCallback(async () => {
        if (!selectedScene) {
            toast("Pick a scene", "Select a scene before switching the program feed.");
            return;
        }
        try {
            await setScene(selectedScene);
            toast("Scene switched", `${selectedScene} is now live.`);
        } catch (error: any) {
            toast("Scene change failed", error?.message ?? "OBS rejected the scene change.");
        }
    }, [selectedScene, setScene, toast]);

    const triggerScenesReload = useCallback(async () => {
        try {
            await refreshScenes();
            if (selectedScene) {
                await refreshSources(selectedScene).catch(() => undefined);
            }
            toast("Scenes synced");
        } catch (error: any) {
            toast("Scene sync failed", error?.message ?? "Could not reload scenes.");
        }
    }, [refreshScenes, refreshSources, selectedScene, toast]);

    const refreshAll = useCallback(async () => {
        try {
            await Promise.all([
                refreshHealth(),
                refreshScenes(),
                refreshSources(selectedScene ?? undefined),
            ]);
            toast("Status refreshed");
        } catch (error: any) {
            toast("Refresh failed", error?.message ?? "OBS API unavailable.");
        }
    }, [refreshHealth, refreshScenes, refreshSources, selectedScene, toast]);

    const handleStream = useCallback(
        async (mode: "start" | "stop") => {
            try {
                if (mode === "start") await startStream();
                else await stopStream();
                toast(`Stream ${mode === "start" ? "started" : "stopped"}`);
            } catch (error: any) {
                toast("Stream action failed", error?.message ?? "Check the OBS logs.");
            }
        },
        [startStream, stopStream, toast]
    );

    const handleRecord = useCallback(
        async (mode: "start" | "stop") => {
            try {
                if (mode === "start") await startRecord();
                else await stopRecord();
                toast(`Recording ${mode === "start" ? "started" : "stopped"}`);
            } catch (error: any) {
                toast("Recording action failed", error?.message ?? "OBS could not toggle recording.");
            }
        },
        [startRecord, stopRecord, toast]
    );

    const statusTiles = useMemo<StatusTile[]>(() => {
        const tiles: StatusTile[] = [
            {
                label: "Connection",
                status: health?.status === "ok" ? "Connected" : "Unknown",
                meta:
                    health?.fetchedAt && health?.obsVersion
                        ? `${health.obsVersion} · ${formatTime(health.fetchedAt)}`
                        : healthRefreshing
                            ? "Pinging OBS…"
                            : "Awaiting ping",
                busy: healthRefreshing,
            },
            {
                label: "Scenes",
                status: sceneList.length ? `${sceneList.length} loaded` : "No scenes",
                meta: scenes?.fetchedAt ? `@ ${formatTime(scenes.fetchedAt)}` : "-",
                busy: scenesRefreshing,
            },
            {
                label: "Program",
                status: currentProgramScene ?? "—",
                meta: currentPreviewScene ? `Preview: ${currentPreviewScene}` : "-",
                busy: healthRefreshing || scenesRefreshing,
            },
        ];

        tiles.push({
            label: "Streaming",
            status: streamingActive ? "Live" : "Offline",
            meta: streamingActive
                ? `Since ${health?.streamingTimecode ?? "latest toggle"}`
                : "Standby",
            busy: healthRefreshing || scenesRefreshing,
        });

        tiles.push({
            label: "Recording",
            status: recordingActive ? "Capturing" : "Idle",
            meta: recordingActive
                ? `Since ${health?.recordingTimecode ?? "latest toggle"}`
                : "Awaiting cue",
            busy: healthRefreshing || scenesRefreshing,
        });

        return tiles;
    }, [
        currentPreviewScene,
        currentProgramScene,
        health?.fetchedAt,
        health?.obsVersion,
        health?.recordingTimecode,
        health?.status,
        health?.streamingTimecode,
        healthRefreshing,
        recordingActive,
        sceneList.length,
        scenes?.fetchedAt,
        scenesRefreshing,
        streamingActive,
    ]);

    const sourceRows = useMemo<SourceRow[]>(() => {
        if (!sources?.items?.length) return [];
        return [...sources.items]
            .sort((a, b) => (a.sceneItemIndex ?? 0) - (b.sceneItemIndex ?? 0))
            .map((item) => ({
                source: item.sourceName ?? `Item ${item.sceneItemId}`,
                kind: item.sourceType ?? "—",
                input: item.inputKind ?? "—",
                visible: Boolean(item.sceneItemEnabled),
                locked: Boolean(item.sceneItemLocked),
                order:
                    typeof item.sceneItemIndex === "number"
                        ? item.sceneItemIndex
                        : item.sceneItemId,
                sceneItemId: item.sceneItemId,
                sourceUuid: typeof item.sourceUuid === "string" ? item.sourceUuid : undefined,
            }));
    }, [sources]);

    const handleCreateCamera = useCallback(
        async (input: { label: string; room?: string; ttlSeconds?: number }) => {
            try {
                await createSession(input);
                toast("Camera link created", "Share the guest link to start streaming.");
            } catch (error: any) {
                toast("Camera create failed", error?.message ?? "Could not create camera link.");
            }
        },
        [createSession, toast]
    );

    const handleRevokeCamera = useCallback(
        async (id: string) => {
            try {
                await revokeSession(id);
                toast("Camera revoked");
            } catch (error: any) {
                toast("Revoke failed", error?.message ?? "Could not revoke the camera.");
            }
        },
        [revokeSession, toast]
    );

    const handleSourcesRefresh = useCallback(() => {
        refreshSources(selectedScene ?? undefined).catch(() => undefined);
    }, [refreshSources, selectedScene]);

    const sourceSceneName = sources?.sceneName ?? selectedScene ?? currentProgramScene ?? null;

    const handleSetSourceVisible = useCallback(
        async (sceneItemId: number, visible: boolean) => {
            if (!sourceSceneName) throw new Error("Scene name is required.");
            await setSourceEnabled(sourceSceneName, sceneItemId, visible);
        },
        [setSourceEnabled, sourceSceneName]
    );

    const handleSetSourceLocked = useCallback(
        async (sceneItemId: number, locked: boolean) => {
            if (!sourceSceneName) throw new Error("Scene name is required.");
            await setSourceLocked(sourceSceneName, sceneItemId, locked);
        },
        [setSourceLocked, sourceSceneName]
    );

    const handleReorderSources = useCallback(
        async (orderedSceneItemIds: number[]) => {
            if (!sourceSceneName) throw new Error("Scene name is required.");
            await reorderSources(sourceSceneName, orderedSceneItemIds);
        },
        [reorderSources, sourceSceneName]
    );

    return (
        <>
            <style jsx>{styles}</style>
            <div className="obscure">
                <div className='obscure__content'>

                    <ObscureHero
                        onRefreshStatus={refreshAll}
                        onReloadScenes={triggerScenesReload}
                        statusBusy={healthRefreshing || scenesRefreshing || sourcesRefreshing}
                        scenesBusy={scenesRefreshing}
                        status={statusTiles}
                    />
<section className="obscure__panels">

                    <CameraPanel
                        sessions={sessions}
                        refreshing={camerasRefreshing}
                        creating={camerasCreating}
                        onRefresh={() => refreshSessions().catch(() => undefined)}
                        onCreate={handleCreateCamera}
                        onRevoke={handleRevokeCamera}
                    />
                        <ScenesPanel
                            scenes={sceneList}
                            selectedScene={selectedScene}
                            currentProgramScene={currentProgramScene}
                            currentPreviewScene={currentPreviewScene}
                            scenesRefreshing={scenesRefreshing}
                            actionInFlight={actionInFlight}
                            onSelect={handleSceneSelect}
                            onCommit={commitScene}
                            onReload={triggerScenesReload}
                        />

                        <TransportPanel
                            streamingActive={streamingActive}
                            recordingActive={recordingActive}
                            streamBusy={streamActionBusy}
                            recordBusy={recordActionBusy}
                            disabled={transportsDisabled}
                            onStreamToggle={(mode) => void handleStream(mode)}
                            onRecordToggle={(mode) => void handleRecord(mode)}
                        />

                        <SourcesPanel
                            rows={sourceRows}
                            sceneName={sourceSceneName}
                            loading={sourcesRefreshing}
                            lastUpdated={sources?.fetchedAt}
                            onRefresh={handleSourcesRefresh}
                            onSetVisible={handleSetSourceVisible}
                            onSetLocked={handleSetSourceLocked}
                            onReorder={handleReorderSources}
                        />
                    </section>



                    {lastError && (
                        <div className="obscure__alert" role="status">
                            <div className="obscure__alert-title">Latest response</div>
                            <p>{lastError}</p>
                        </div>
                    )}
                    {camerasError && (
                        <div className="obscure__alert" role="status">
                            <div className="obscure__alert-title">Camera sync</div>
                            <p>{camerasError}</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Obscure;
