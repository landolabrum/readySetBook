import React, { useMemo } from 'react';
import styles from './OverlayCard.scss';

import type { CanonOverlay, CardOverlayItem } from '@Canopy/models/canopyOverlayTypes';
import { normalizeCardItems } from '@Canopy/models/canopyOverlayTypes';
import type { OverlayRenderContext } from '@Canopy/lib/overlayRegistry';
import { buildCardRuntimeData, resolveCardItemValue } from './cardBindingResolver';

type Props = {
  overlay: CanonOverlay;
  ctx: OverlayRenderContext;
};

const OverlayCard: React.FC<Props> = ({ overlay, ctx }) => {
  const data = ((overlay as any)?.data ?? {}) as any;

  const items: CardOverlayItem[] = useMemo(
    () => normalizeCardItems(data?.items),
    [data?.items]
  );
  const runtime = useMemo(
    () => buildCardRuntimeData(ctx, data, overlay?.title),
    [ctx, data, overlay?.title]
  );

  const columns = Math.max(1, Math.min(6, Number(data?.columns ?? 3) || 3));
  const gap = Math.max(0, Math.min(80, Number(data?.gap ?? 10) || 10));
  const padding = Math.max(0, Math.min(80, Number(data?.padding ?? 12) || 12));
  const minItemHeight = Math.max(40, Math.min(640, Number(data?.minItemHeight ?? 90) || 90));

  const panelStyle: React.CSSProperties = {
    background: data?.background || '#0b1017dd',
    color: data?.textColor || '#f5f8ff',
    padding,
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="overlay-card" style={panelStyle}>
        {(data?.headline || overlay?.title) && (
          <div className="overlay-card__headline">{data?.headline || overlay?.title}</div>
        )}
        {!!data?.subheadline && <div className="overlay-card__subheadline">{data.subheadline}</div>}

        <div
          className="overlay-card__grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap,
          }}
        >
          {items.map((item, idx) => {
            const colSpan = Math.max(1, Math.min(6, Number(item?.colSpan ?? 1) || 1));
            const rowSpan = Math.max(1, Math.min(6, Number(item?.rowSpan ?? 1) || 1));
            const minHeight = minItemHeight * rowSpan;
            const itemStyle: React.CSSProperties = {
              background: item?.background || data?.itemBackground || '#121c2bdd',
              color: item?.textColor || data?.textColor || '#f5f8ff',
              minHeight,
              gridColumn: `span ${Math.min(columns, colSpan)}`,
              gridRow: `span ${rowSpan}`,
              borderLeftColor: item?.accent || 'rgba(255,255,255,0.15)',
            };

            return (
              <div key={item.id || `card-item-${idx}`} className="overlay-card__item" style={itemStyle}>
                {item?.imageUrl && <img className="overlay-card__image" src={item.imageUrl} alt={item.title || `item-${idx}`} />}
                {item?.title && <div className="overlay-card__title">{item.title}</div>}
                <div className="overlay-card__value">{resolveCardItemValue(item, runtime, ctx)}</div>
                {item?.subtitle && <div className="overlay-card__subtitle">{item.subtitle}</div>}
                {item?.description && <div className="overlay-card__description">{item.description}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default OverlayCard;
