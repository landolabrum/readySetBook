import React, { useMemo, useState } from 'react';
import styles from './CanopyFeedEventPage.scss';
import { buildPreviewUrl } from '@Canopy/hooks/useCanopyFeed';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { useCanopyFeedContext } from '../../provider/CanopyFeedProvider';
import StreamProviderIcon from '@Canopy/transmitter/views/CanopyPanel/views/StreamPanel/views/StreamProviderIcon/StreamProviderIcon';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiMedia from '@webstack/components/UiMedia/controller/UiMedia';

const formatTime = (iso?: string | null, tz?: string | null): string => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            timeZone: tz || undefined,
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    } catch {
        return iso;
    }
};

const providerUrl = (provider: string, userHandle?: string | null): string | null => {
    const handle = (userHandle || '').trim();
    if (!handle) return null;

    if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle;
    }

    switch (provider) {
        case 'twitch':
            return `https://twitch.tv/${handle}`;
        case 'youtube':
            return handle.startsWith('@')
                ? `https://youtube.com/${handle}/streams`
                : `https://youtube.com/@${handle}/streams`;
        case 'facebook':
            return `https://facebook.com/${handle}`;
        default:
            return null;
    }
};

const CanopyFeedEventPage: React.FC = () => {
    const { activeEventId, activeEvent, closeEventPage, feed } =
        useCanopyFeedContext();

    const [showPlayer, setShowPlayer] = useState(false);

    const previewSrc = useMemo(
        () => (activeEvent ? buildPreviewUrl(activeEvent) : null),
        [activeEvent],
    );

    const hlsProxySrc = activeEvent
        ? `${String(process.env.NEXT_PUBLIC_PRODUCTION_SERVER?.trim() || '')}/streaming/hls-proxy/stream/${encodeURIComponent(activeEvent.id)}.m3u8`
        : null;

    if (!activeEventId) return null;

    return (
        <>
            <style jsx>{styles}</style>
            <div className="canopy-feed-event">
                <div className="canopy-feed-event__header">
                    <UiButton
                        onClick={closeEventPage}
                        variant="link"
                        traits={{ beforeIcon: 'fa-chevron-left' }}
                    >

                        Back to feed
                    </UiButton>
                    <div className="canopy-feed-event__crumb">
                        <span>Event</span>
                        <strong>{activeEvent?.name ?? 'Loading event…'}</strong>
                    </div>
                </div>

                {!activeEvent && (
                    <div className="canopy-feed-event__empty">
                        <UiIcon icon="fa-satellite-dish" />
                        <p>{feed.loading ? 'Loading event…' : 'Event not found'}</p>
                    </div>
                )}

                {activeEvent && (
                    <div className="canopy-feed-event__body">
                        <div className="canopy-feed-event__preview">
                            {showPlayer && hlsProxySrc ? (
                                <div className="canopy-feed-event__player">
                                    <UiMedia
                                        type="video"
                                        src={hlsProxySrc}
                                        autoplay
                                        controls
                                        muted
                                    />
                                    <button
                                        className="canopy-feed-event__player-close"
                                        onClick={() => setShowPlayer(false)}
                                        type="button"
                                    >
                                        <UiIcon icon="fa-xmark" />
                                    </button>
                                </div>
                            ) : previewSrc ? (
                                <img src={previewSrc} alt={activeEvent.name} draggable={false} />
                            ) : (
                                <div className="canopy-feed-event__placeholder">
                                    <UiIcon icon="fa-broadcast-tower" />
                                </div>
                            )}
                            {activeEvent.isLive && !showPlayer && (
                                <span className="canopy-feed-event__badge">
                                    <span className="canopy-feed-event__badge-dot" />
                                    LIVE
                                </span>
                            )}
                        </div>

                        <div className="canopy-feed-event__details">
                            <h1 className="canopy-feed-event__title">{activeEvent.name}</h1>

                            <div className="canopy-feed-event__meta">
                                {activeEvent.streams[0] && (
                                    <div className="canopy-feed-event__meta-row">
                                        <StreamProviderIcon
                                            provider={activeEvent.streams[0].provider || 'custom'}
                                            userHandle={activeEvent.streams[0].userHandle || undefined}
                                            providerActive={activeEvent.streams[0].enabled}
                                        />
                                        <span>
                                            {activeEvent.streams[0].provider}
                                            {activeEvent.streams[0].userHandle && ' · '}
                                            {activeEvent.streams[0].userHandle && (
                                                (() => {
                                                    const href = providerUrl(
                                                        activeEvent.streams[0].provider,
                                                        activeEvent.streams[0].userHandle,
                                                    );
                                                    return href ? (
                                                        <a
                                                            href={href}
                                                            target="_blank"
                                                            rel="noreferrer noopener"
                                                        >
                                                            {activeEvent.streams[0].userHandle}
                                                        </a>
                                                    ) : (
                                                        activeEvent.streams[0].userHandle
                                                    );
                                                })()
                                            )}
                                        </span>
                                    </div>
                                )}

                                {(activeEvent.startsAt || activeEvent.endsAt) && (
                                    <div className="canopy-feed-event__meta-row">
                                        <UiIcon icon="fa-clock" />
                                        <span>
                                            {formatTime(activeEvent.startsAt, activeEvent.timezone)}
                                            {activeEvent.endsAt &&
                                                ` — ${formatTime(activeEvent.endsAt, activeEvent.timezone)}`}
                                        </span>
                                    </div>
                                )}

                                {activeEvent.streams.length > 1 && (
                                    <div className="canopy-feed-event__meta-row">
                                        <UiIcon icon="fa-picture-in-picture" />
                                        <span>{activeEvent.streams.length} active streams</span>
                                    </div>
                                )}
                            </div>
                            {activeEvent.isLive && hlsProxySrc && !showPlayer && (
                                <div className="canopy-feed-event__cta">
                                    <UiButton
                                        onClick={() => setShowPlayer(true)}
                                        traits={{
                                            afterIcon: 'fa-arrow-right',
                                        }}
                                    >
                                        Watch Stream
                                    </UiButton>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default CanopyFeedEventPage;
