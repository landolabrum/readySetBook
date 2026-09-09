import React, { useState, useMemo } from 'react';
import styles from './EventCard.scss';
import type { FeedItem } from '@Canopy/hooks/useCanopyFeed';
import { buildPreviewUrl } from '@Canopy/hooks/useCanopyFeed';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';

interface EventCardProps {
    item: FeedItem;
    refreshKey?: number;
    onClick?: () => void;
}

const PROVIDER_ICONS: Record<string, string> = {
    twitch: 'fa-twitch',
    youtube: 'fa-youtube',
    facebook: 'fa-facebook',
    custom: 'fa-broadcast-tower',
};

const EventCard: React.FC<EventCardProps> = ({ item, refreshKey, onClick }) => {
    const [imgError, setImgError] = useState(false);
    const primaryStream = item.streams[0];

    const previewSrc = useMemo(() => {
        const base = buildPreviewUrl(item);
        if (!base) return null;
        return refreshKey ? `${base}&_t=${refreshKey}` : base;
    }, [item, refreshKey]);

    const providerIcon =
        PROVIDER_ICONS[primaryStream?.provider ?? 'custom'] ?? 'fa-broadcast-tower';

    return (
        <>
            <style jsx>{styles}</style>
            <div
                className="event-card"
                onClick={onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onClick?.();
                }}
            >
                <div className="event-card__thumbnail">
                    {previewSrc && !imgError ? (
                        <img
                            src={previewSrc}
                            alt={item.name}
                            onError={() => setImgError(true)}
                            loading="lazy"
                            draggable={false}
                        />
                    ) : (
                        <div className="event-card__placeholder">
                            <UiIcon icon="fa-broadcast-tower" />
                        </div>
                    )}
                    {item.isLive && primaryStream && (
                        <span className="event-card__badge">
                            <span className="event-card__badge-dot" />
                            LIVE
                        </span>
                    )}
                </div>
                <div className="event-card__info">
                    <div className="event-card__title">{item.name}</div>
                    {primaryStream && (
                        <span className="event-card__meta">
                            <UiIcon icon={providerIcon} />
                            <span>{primaryStream.userHandle || primaryStream.provider}</span>
                        </span>
                    )}
                </div>
            </div>
        </>
    );
};

export default EventCard;
