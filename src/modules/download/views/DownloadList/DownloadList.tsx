// Relative Path: ./DownloadList.tsx
import React from 'react';
import styles from './DownloadList.scss';
import AdaptGrid from '@webstack/components/Containers/AdaptGrid/AdaptGrid';
import DownloadListItem from './DownloadListItem';
import { DeviceClass, IDownloadTarget } from '../../models/IDownloadTarget';

interface IDownloadList {
  targets: IDownloadTarget[] | null;
  loading?: boolean;
  error?: string | null;
  onSelect: (deviceClass: DeviceClass) => void;
}

const DownloadList: React.FC<IDownloadList> = ({ targets, loading, error, onSelect }) => {
  return (
    <>
      <style jsx>{styles}</style>
      <div className='download-list'>
        {error && <div className='download-list__error'>{error}</div>}
        {loading && !targets && <div className='download-list__state'>Loading device classes…</div>}
        {!loading && targets && targets.length === 0 && (
          <div className='download-list__state'>No device classes are available right now.</div>
        )}
        <AdaptGrid xs={1} sm={2} lg={3} gap={20}>
          {(targets || []).map((t) => (
            <DownloadListItem key={t.deviceClass} target={t} onSelect={onSelect} />
          ))}
        </AdaptGrid>
      </div>
    </>
  );
};

export default DownloadList;
