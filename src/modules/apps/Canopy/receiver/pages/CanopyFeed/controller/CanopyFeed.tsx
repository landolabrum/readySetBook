import React from 'react';
import styles from './CanopyFeed.scss';
import CanopyFeedList from '../views/CanopyFeedList/CanopyFeedList';
import CanopyFeedDescription from '../views/CanopyFeedDescription/CanopyFeedDescription';
import CanopyFeedEventPage from '../views/CanopyFeedEventPage/CanopyFeedEventPage';
import {
  CanopyFeedProvider,
  useCanopyFeedContext,
} from '../provider/CanopyFeedProvider';

const CanopyFeedBody: React.FC = () => {
  const {
    feed,
    refreshKey,
    selectedItem,
    selectItem,
    clearSelection,
    openEventPage,
    activeEventId,
  } = useCanopyFeedContext();

  if (activeEventId) {
    return (
      <>
        <style jsx>{styles}</style>
        <div className="canopy-feed">
          <CanopyFeedEventPage />
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx>{styles}</style>
      <div className="canopy-feed">
        {/* <div className="canopy-feed__header">
          <h1 className="canopy-feed__title">Live Events</h1>
          <p className="canopy-feed__subtitle">
            Watch live streams and events from around the world
          </p>
        </div> */}
        <div className="canopy-feed__content">
          <CanopyFeedList
            items={feed.items}
            loading={feed.loading}
            search={feed.search}
            onSearch={feed.setSearch}
            filter={feed.filter}
            onFilter={feed.setFilter}
            page={feed.page}
            totalPages={feed.totalPages}
            onPageChange={feed.setPage}
            refreshKey={refreshKey}
            onCardClick={selectItem}
          />
        </div>
        {selectedItem && (
          <CanopyFeedDescription
            item={selectedItem}
            onClose={clearSelection}
            onWatch={() => openEventPage(selectedItem)}
          />
        )}
      </div>
    </>
  );
};

const CanopyFeed: React.FC = () => {
  return (
    <CanopyFeedProvider>
      <CanopyFeedBody />
    </CanopyFeedProvider>
  );
};

export default CanopyFeed;