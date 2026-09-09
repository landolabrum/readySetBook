// ShareMedia — render a screen/camera/encoder/pull overlay.
//
// Share-family overlays are always either a live MediaStream (the producer's
// own capture) or an HLS playback URL. There's no iframe path, no image
// path, no playlist — that complexity lives in the generic <OverlayMedia>.

import React, { useRef } from 'react';
import styles from './ShareMedia.scss';
import { useAudioMeter } from '@webstack/hooks/audio/useAudioMeter';
import useShareStream from '../hooks/useShareStream';
import type { ResolvedShareSource } from '@Canopy/lib/share/resolveShareSource';

export type ShareMediaProps = {
    overlayId?: string | number;
    resolved: ResolvedShareSource;
    title?: string | null;
    description?: string | null;
    variant?: string;
    autoplay?: boolean;
    muted?: boolean;
    playing?: boolean;
    volume?: number;
    poster?: string;
};

const ShareMedia: React.FC<ShareMediaProps> = ({
    overlayId,
    resolved,
    title,
    description,
    variant = 'default',
    autoplay = true,
    muted = true,
    playing = true,
    volume = 1,
    poster,
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const cls = `share-media share-media--${variant}`;

    const { state, enableSound } = useShareStream({
        videoRef, resolved, autoplay, muted, playing, volume,
    });

    useAudioMeter({
        videoEl: videoRef.current,
        stream: resolved.kind === 'stream' ? resolved.stream : undefined,
        overlayId: String(overlayId ?? ''),
    });

    if (resolved.kind === 'ended') {
        return (
            <div className={cls}>
                <style jsx>{styles}</style>
                <div className="share-media__placeholder share-media__placeholder--ended">Stream ended</div>
            </div>
        );
    }

    if (resolved.kind === 'waiting') {
        // No sessionId means we can't even poll — render an empty transparent
        // container rather than alarmist "no source" chrome on the broadcast.
        if (!resolved.sessionId) {
            return <div className={cls}><style jsx>{styles}</style></div>;
        }
        return (
            <div className={cls}>
                <style jsx>{styles}</style>
                <div className="share-media__placeholder share-media__placeholder--waiting">
                    Waiting for stream…
                </div>
            </div>
        );
    }

    return (
        <div className={cls} role="region" aria-label={title || 'share'}>
            <style jsx>{styles}</style>
            <video
                ref={videoRef}
                className="share-media__video"
                autoPlay={autoplay}
                muted={muted}
                playsInline
                poster={poster || undefined}
                controls={false}
            />
            {state === 'autoplay-blocked' && (
                <button type="button" className="share-media__pill share-media__pill--cta" onClick={enableSound}>
                    Tap for sound
                </button>
            )}
            {state === 'connecting' && (
                <div className="share-media__pill share-media__pill--connecting">Connecting…</div>
            )}
            {state === 'error' && (
                <div className="share-media__pill share-media__pill--error">Stream error</div>
            )}
            {(title || description) && (
                <div className="share-media__label">
                    {title ? <div className="share-media__title">{title}</div> : null}
                    {description ? <div className="share-media__desc">{description}</div> : null}
                </div>
            )}
        </div>
    );
};

export default ShareMedia;
