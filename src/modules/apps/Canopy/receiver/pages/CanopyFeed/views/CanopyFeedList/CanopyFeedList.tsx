import React from 'react';
import styles from './CanopyFeedList.scss';
import EventCard from '../../components/EventCard/EventCard';
import type { FeedItem } from '@Canopy/hooks/useCanopyFeed';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import UiSelect from '@webstack/components/UiForm/components/UiSelect/UiSelect';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Events' },
  { value: 'live', label: 'Live Now' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

interface CanopyFeedListProps {
  items: FeedItem[];
  loading: boolean;
  search: string;
  onSearch: (val: string) => void;
  filter: string;
  onFilter: (val: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  refreshKey?: number;
  onCardClick?: (item: FeedItem) => void;
}

const CanopyFeedList: React.FC<CanopyFeedListProps> = ({
  items,
  loading,
  search,
  onSearch,
  filter,
  onFilter,
  page,
  totalPages,
  onPageChange,
  refreshKey,
  onCardClick,
}) => {
  return (
    <>
      <style jsx>{styles}</style>
      <div className="canopy-feed-list">
        {/* Search + filter toolbar */}
        <div className="canopy-feed-list__toolbar">
          {/* <div> */}
          <UiInput
            type="text"
            value={search}
            placeholder="Search events…"
            onChange={(e) => onSearch(e.target.value)}
            traits={{ afterIcon: { icon: search ? 'fa-xmark' : 'fa-magnifying-glass', onClick: () => onSearch('') } }}
            />
            {/* </div> */}
            {/* <div>

          <UiSelect
            options={FILTER_OPTIONS}
            value={filter}
            onSelect={(opt: any) => onFilter(opt?.value ?? 'all')}
            />
            </div> */}
        </div>
        {/* Grid */}
        {loading && !items.length ? (
          <div className="canopy-feed-list__loading">
            <UiIcon icon="spinner" />
            <span>Loading events…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="canopy-feed-list__empty">
            <UiIcon icon="fa-satellite-dish" />
            <p>{search ? `No events matching "${search}"` : 'No live events right now'}</p>
          </div>
        ) : (
          <div className="canopy-feed-list__grid">
            {items.map((item) => (
              <EventCard
                key={item.id}
                item={item}
                refreshKey={refreshKey}
                onClick={() => onCardClick?.(item)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="canopy-feed-list__pagination">
            <button
              className="canopy-feed-list__page-btn"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <UiIcon icon="fa-chevron-left" />
            </button>
            <span className="canopy-feed-list__page-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="canopy-feed-list__page-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <UiIcon icon="fa-chevron-right" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CanopyFeedList;
