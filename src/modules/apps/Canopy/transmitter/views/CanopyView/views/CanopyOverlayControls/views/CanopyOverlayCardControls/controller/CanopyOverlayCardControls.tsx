import React, { useMemo, useState } from 'react';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import styles from './CanopyOverlayCardControls.scss';
import { useLiveStreamCtx } from '@Canopy/context/CanopyProvider';

import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';
import {
  overlayCardFields,
  cardItemFields,
  normalizeCardItems,
  type CardBindingSource,
  type CardBindingMode,
} from '@Canopy/models/canopyOverlayTypes';
import {
  addTemplateItem,
  duplicateActiveItem,
  moveActiveItem,
  moveItemByIndex,
  quickPairActiveItem,
  removeActiveItem,
} from '../functions/cardItemActions';

type Props = {
  overlay: CanonOverlay;
  current?: { id?: string | number; name?: string; lat?: number | null; lng?: number | null } | null;
  onChange: (e: any) => void;
};

const CanopyOverlayCardControls: React.FC<Props> = ({ overlay, current, onChange }) => {
  const { roster } = useLiveStreamCtx();
  const items = useMemo(() => normalizeCardItems((overlay as any)?.data?.items), [overlay]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const safeIdx = Math.min(Math.max(activeIdx, 0), Math.max(0, items.length - 1));

  const patchItems = (next: any[]) => {
    onChange({ target: { name: 'data.items', value: next } });
  };

  const addTemplate = (kind: 'stat' | 'image' | 'banner') => {
    const { next, nextIndex } = addTemplateItem(items, kind);
    patchItems(next);
    setActiveIdx(nextIndex);
  };

  const removeActive = () => {
    const { next, nextIndex } = removeActiveItem(items, safeIdx);
    patchItems(next);
    setActiveIdx(nextIndex);
  };

  const duplicateActive = () => {
    const { next, nextIndex } = duplicateActiveItem(items, safeIdx);
    patchItems(next);
    setActiveIdx(nextIndex);
  };

  const moveActive = (direction: -1 | 1) => {
    const { next, nextIndex } = moveActiveItem(items, safeIdx, direction);
    patchItems(next);
    setActiveIdx(nextIndex);
  };

  const moveItem = (from: number, to: number) => {
    const next = moveItemByIndex(items, from, to);
    patchItems(next);
    setActiveIdx(to);
  };

  const quickPair = (source: CardBindingSource, key: string, mode?: CardBindingMode) => {
    const next = quickPairActiveItem(items, safeIdx, source, key, mode);
    patchItems(next);
  };

  const seedEventInfo = () => {
    onChange({
      target: {
        name: 'data.eventInfo',
        value: {
          id: current?.id ?? null,
          name: current?.name ?? '',
          lat: current?.lat ?? null,
          lng: current?.lng ?? null,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="card-controls">
        <div className="card-controls__section">
          <UiForm title="Card Layout" fields={overlayCardFields(overlay)} onChange={onChange} />
          <div className="card-controls__actions">
            <UiButton variant="ghost" traits={{ beforeIcon: 'fa-database' }} onClick={seedEventInfo}>
              Save Event Snapshot Fallback
            </UiButton>
          </div>
        </div>

        <div className="card-controls__section">
          <div className="card-controls__header">Build with templates</div>
          <div className="card-controls__actions">
            <UiButton traits={{ beforeIcon: 'fa-table-cells' }} onClick={() => addTemplate('stat')}>
              Add Stat Tile
            </UiButton>
            <UiButton traits={{ beforeIcon: 'fa-image' }} onClick={() => addTemplate('image')}>
              Add Image + Text
            </UiButton>
            <UiButton traits={{ beforeIcon: 'fa-bolt' }} onClick={() => addTemplate('banner')}>
              Add Highlight Banner
            </UiButton>
          </div>
        </div>

        <div className="card-controls__section">
          <div className="card-controls__header">Grid items</div>
          <div className="card-controls__items">
            {items.map((item, idx) => (
              <button
                key={item.id || `item-${idx}`}
                type="button"
                draggable
                className={`card-controls__item ${idx === safeIdx ? 'is-active' : ''}`}
                onClick={() => setActiveIdx(idx)}
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx == null) return;
                  moveItem(dragIdx, idx);
                  setDragIdx(null);
                }}
                onDragEnd={() => setDragIdx(null)}
              >
                <span className="card-controls__item-title">{item.title || `Item ${idx + 1}`}</span>
                <span className="card-controls__item-sub">
                  {item.binding?.source || 'static'} / {item.binding?.key || 'manual'}
                </span>
              </button>
            ))}
          </div>

          <div className="card-controls__actions">
            <UiButton variant="ghost" traits={{ beforeIcon: 'fa-arrow-up' }} onClick={() => moveActive(-1)}>
              Move up
            </UiButton>
            <UiButton variant="ghost" traits={{ beforeIcon: 'fa-arrow-down' }} onClick={() => moveActive(1)}>
              Move down
            </UiButton>
            <UiButton variant="ghost" traits={{ beforeIcon: 'fa-clone' }} onClick={duplicateActive}>
              Duplicate item
            </UiButton>
            <UiButton variant="danger" traits={{ beforeIcon: 'fa-trash-can' }} onClick={removeActive}>
              Remove item
            </UiButton>
          </div>

          <div className="card-controls__pairing">
            <div className="card-controls__pairing-title">Quick pair data</div>
            <div className="card-controls__actions">
              <UiButton variant="flat" onClick={() => quickPair('event_info', 'name')}>
                Event Name
              </UiButton>
              <UiButton variant="flat" onClick={() => quickPair('event_team', 'team_count', 'aggregate')}>
                Team Count
              </UiButton>
              <UiButton variant="flat" onClick={() => quickPair('event_team', 'leader_score', 'aggregate')}>
                Leader Score
              </UiButton>
              <UiButton variant="flat" onClick={() => quickPair('gps', 'speed_mph', 'record')}>
                GPS Speed
              </UiButton>
            </div>
          </div>

          <UiForm
            title={`Item ${safeIdx + 1}`}
            fields={cardItemFields(overlay, safeIdx, { roster: roster as any })}
            onChange={onChange}
          />
        </div>

        <div className="form__hint card-controls__hint">
          Tip: Event Info, Event Teams, and GPS bindings resolve live inside CanopyMedia. Snapshot fallback is only needed when no live event meta is available.
        </div>
      </div>
    </>
  );
};

export default CanopyOverlayCardControls;
