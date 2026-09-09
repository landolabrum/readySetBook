// Relative Path: ./DownloadListItem.tsx
import React from 'react';
import styles from './DownloadListItem.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { DeviceClass, IDownloadTarget } from '../../models/IDownloadTarget';

interface IDownloadListItem {
  target: IDownloadTarget;
  onSelect: (deviceClass: DeviceClass) => void;
}

const DownloadListItem: React.FC<IDownloadListItem> = ({ target, onSelect }) => {
  return (
    <>
      <style jsx>{styles}</style>
      <button
        type='button'
        className='download-list-item'
        onClick={() => onSelect(target.deviceClass)}
        aria-label={`Download for ${target.label}`}
      >
        <div className='download-list-item__icon'>
          <UiIcon icon={target.icon} />
        </div>
        <div className='download-list-item__label'>{target.label}</div>
        <div className='download-list-item__meta'>
          {target.os} · {target.arch}
        </div>
        <div className='download-list-item__cta'>Get install command →</div>
      </button>
    </>
  );
};

export default DownloadListItem;
