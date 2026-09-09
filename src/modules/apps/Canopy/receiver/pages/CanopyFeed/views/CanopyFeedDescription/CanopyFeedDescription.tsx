import React from 'react';
import styles from './CanopyFeedDescription.scss';
import type { FeedItem } from '@Canopy/hooks/useCanopyFeed';
import { buildPreviewUrl } from '@Canopy/hooks/useCanopyFeed';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';

interface CanopyFeedDescriptionProps {
  item: FeedItem;
  onClose: () => void;
  onWatch: () => void;
}

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

const CanopyFeedDescription: React.FC<CanopyFeedDescriptionProps> = ({
  item,
  onClose,
  onWatch,
}) => {
  const previewSrc = buildPreviewUrl(item);
  const primaryStream = item.streams[0];

  return (
    <>
      <style jsx>{styles}</style>
      <div className="canopy-feed-desc" onClick={onClose}>
        <div className="canopy-feed-desc__panel" onClick={(e) => e.stopPropagation()}>
          <button className="canopy-feed-desc__close" onClick={onClose} aria-label="Close">
            <UiIcon icon="fa-xmark" />
          </button>

          <div className="canopy-feed-desc__preview">
            {previewSrc ? (
              <img src={previewSrc} alt={item.name} draggable={false} />
            ) : (
              <div className="canopy-feed-desc__placeholder">
                <UiIcon icon="fa-broadcast-tower" />
              </div>
            )}
            {item.isLive && (
              <span className="canopy-feed-desc__badge">
                <span className="canopy-feed-desc__badge-dot" />
                LIVE
              </span>
            )}
          </div>

          <div className="canopy-feed-desc__body">
            <h2 className="canopy-feed-desc__title">{item.name}</h2>

            {(item.startsAt || primaryStream) && (
              <div className="canopy-feed-desc__details">
                {item.startsAt && (
                  <div className="canopy-feed-desc__detail-row">
                    <UiIcon icon="fa-clock" />
                    <span>
                      {formatTime(item.startsAt, item.timezone)}
                      {item.endsAt && ` — ${formatTime(item.endsAt, item.timezone)}`}
                    </span>
                  </div>
                )}
                {primaryStream && (
                  <div className="canopy-feed-desc__detail-row">
                    <UiIcon icon="fa-signal-stream" />
                    <span>
                      {primaryStream.provider}
                      {primaryStream.userHandle && ` · ${primaryStream.userHandle}`}
                    </span>
                  </div>
                )}
                {item.streams.length > 1 && (
                  <div className="canopy-feed-desc__detail-row">
                    <UiIcon icon="fa-picture-in-picture" />
                    <span>{item.streams.length} active streams</span>
                  </div>
                )}
              </div>
            )}

            <button className="canopy-feed-desc__watch-btn" onClick={onWatch}>
              <UiIcon icon="fa-play" />
              Open Event Page
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CanopyFeedDescription;
