// Relative Path: ./PipelineMedia.tsx
import React, { useEffect, useMemo, useRef } from "react";
import styles from "./PipelineMedia.scss";
import UiMedia, { IMedia } from "@webstack/components/UiMedia/controller/UiMedia";

type Props = {
    media?: IMedia;
    stream?: MediaStream | null;
    /** Optional callback to expose the underlying video element when a stream is rendered */
    onVideoRef?: (video: HTMLVideoElement | null) => void;
    autoPlay?: boolean;
    muted?: boolean;
    playsInline?: boolean;
    controls?: boolean;
    loop?: boolean;
    poster?: string;
    className?: string;
};

const inferType = (src?: string): string | undefined => {
    if (!src) return undefined;
    const lowered = src.toLowerCase();
    if (lowered.endsWith(".m3u8")) return "video"; // ensure UiMedia treats HLS as video and loads hls.js when needed
    if (lowered.endsWith(".mp4")) return "video";
    if (lowered.endsWith(".webm")) return "video";
    return undefined;
};

const PipelineMedia: React.FC<Props> = ({
    media,
    stream,
    onVideoRef,
    autoPlay,
    muted,
    playsInline,
    controls,
    loop,
    poster,
    className,
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hasVideoTrack = stream?.getVideoTracks().length ? true : false;

    const resolved: IMedia | null = useMemo(() => {
        if (!media?.src) return null;
        const type = media.type || inferType(media.src);
        return {
            autoPlay: autoPlay ?? true,
            muted: muted ?? true,
            playsInline: playsInline ?? true,
            controls: controls ?? false,
            loop: loop ?? false,
            poster: poster ?? media.poster,
            ...media,
            type,
        } as IMedia;
    }, [autoPlay, controls, loop, media, muted, playsInline, poster]);

    useEffect(() => {
        if (!videoRef.current) return;
        const el = videoRef.current;
        onVideoRef?.(el);

        if (!stream) {
            el.pause?.();
            el.srcObject = null;
            return;
        }

        const trackInfo = stream.getTracks().map((t) => ({ kind: t.kind, label: t.label }));
        console.debug("[PipelineMedia] stream attached", trackInfo);

        if (el.srcObject !== stream) {
            el.srcObject = stream;
        }

        el.muted = muted ?? true;
        el.playsInline = playsInline ?? true;
        el.autoplay = autoPlay ?? true;

        const start = () => el.play?.().catch((err) => console.warn("[PipelineMedia] play() failed", err));

        if (el.readyState >= 2) {
            start();
        } else {
            const handleLoaded = () => start();
            el.addEventListener("loadedmetadata", handleLoaded);
            el.addEventListener("canplay", handleLoaded);
            return () => {
                el.removeEventListener("loadedmetadata", handleLoaded);
                el.removeEventListener("canplay", handleLoaded);
                el.pause?.();
                el.srcObject = null;
                onVideoRef?.(null);
            };
        }

        return () => {
            el.pause?.();
            el.srcObject = null;
            onVideoRef?.(null);
        };
    }, [autoPlay, muted, onVideoRef, playsInline, stream]);

    const key = stream?.id ? `stream:${stream.id}` : resolved ? `${resolved.src}:${resolved.type ?? "unknown"}` : "pipeline-media";
    const trackSummary = stream?.getTracks().map((t) => `${t.kind}:${t.label || t.id}`).join(" | ");

    return (
        <>
            <style jsx>{styles}</style>
            <div
                className={`pipeline-media ${className ?? ""}`}
                data-has-stream={!!stream}
                data-has-src={!!resolved?.src}
                data-track-count={stream?.getTracks().length ?? 0}
            >
                {stream && (
                    <video
                        key={key}
                        ref={videoRef}
                        autoPlay={autoPlay ?? true}
                        muted={muted ?? true}
                        playsInline={playsInline ?? true}
                        controls={controls ?? false}
                        loop={loop ?? false}
                        poster={poster as string}
                        className="pipeline-media__video"
                    />
                )}
                {!stream && resolved && <UiMedia key={key} {...resolved} />}
                {!stream && !resolved && <div className="pipeline-media__placeholder">No media source provided</div>}
                {stream && (
                    <div className="pipeline-media__overlay">Stream attached {trackSummary ? `(${trackSummary})` : ""}</div>
                )}
                {stream && !hasVideoTrack && (
                    <div className="pipeline-media__error">No video track detected in stream.</div>
                )}
            </div>
        </>
    );
};

export default PipelineMedia;