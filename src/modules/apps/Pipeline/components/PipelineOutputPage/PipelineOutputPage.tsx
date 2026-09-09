import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import styles from "./PipelineOutputPage.scss";
import PipelineMedia from "../../views/PipeLineMedia/controller/PipelineMedia";
import { IMedia } from "@webstack/components/UiMedia/controller/UiMedia";
import { PipelineProvider, usePipeline } from "../../context/PipelineProvider";
import { PipelineSession } from "~/src/core/services/PipelineService/PipelineService";

const PipelineOutputInner: React.FC = () => {
    const router = useRouter();
    const { getSession } = usePipeline();
    const [session, setSession] = useState<PipelineSession | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const streamId = typeof router.query?.streamId === "string" ? router.query.streamId : undefined;

    useEffect(() => {
        if (!streamId) return;
        setLoading(true);
        setError(null);
        getSession(streamId)
            .then(setSession)
            .catch((err: any) => setError(err?.message ?? "Unable to load stream"))
            .finally(() => setLoading(false));
    }, [getSession, streamId]);

    const isMediaUrl = (url?: string) => {
        if (!url) return false;
        const lowered = url.toLowerCase();
        return lowered.includes(".m3u8") || lowered.endsWith(".mp4") || lowered.endsWith(".webm");
    };

    const hlsUrl = session?.meta?.hlsUrl || (isMediaUrl(session?.viewUrl) && session?.viewUrl ? session.viewUrl : undefined);
    const playableUrl = hlsUrl || (isMediaUrl(session?.viewUrl) ? session?.viewUrl : undefined);

    const mediaSource = useMemo<IMedia | null>(() => {
        if (!playableUrl) return null;
        return { src: playableUrl } as IMedia;
    }, [playableUrl]);

    return (
        <>
            <style jsx>{styles}</style>
            <div className="pipeline-output">
                <header className="pipeline-output__header">
                    <h1>Pipeline Stream</h1>
                    {streamId && <span className="pipeline-output__id">ID: {streamId}</span>}
                </header>

                {loading && <div className="pipeline-output__status">Loading stream...</div>}
                {error && <div className="pipeline-output__error">{error}</div>}

                {!loading && !session && !error && (
                    <div className="pipeline-output__status">No stream found.</div>
                )}

                {hlsUrl && (
                    <div className="pipeline-output__link">
                        <div className="pipeline-output__status">HLS playback URL</div>
                        <a href={hlsUrl} target="_blank" rel="noreferrer">
                            {hlsUrl}
                        </a>
                    </div>
                )}

                {mediaSource && (
                    <div className="pipeline-output__player">
                        <PipelineMedia
                            media={mediaSource ?? undefined}
                            autoPlay
                            muted={false}
                            playsInline
                            controls
                            className="pipeline-output__media"
                        />
                    </div>
                )}
            </div>
        </>
    );
};

const PipelineOutputPage: React.FC = () => (
    <PipelineProvider>
        <PipelineOutputInner />
    </PipelineProvider>
);

export default PipelineOutputPage;
