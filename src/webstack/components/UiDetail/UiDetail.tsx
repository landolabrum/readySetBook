// Relative Path: ./UiDetail.tsx
// Label/value detail list. `rows` = label left / value right; `grid` = responsive columns.
import React from 'react';
import styles from './UiDetail.scss';

export interface IUiDetailItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Wrap the value in an external link. */
  link?: string;
  /** Skip rendering this item. */
  hide?: boolean;
}

export interface IUiDetail {
  items: IUiDetailItem[];
  variant?: 'rows' | 'grid';
  /** Placeholder for empty values. Defaults to an em dash. */
  placeholder?: React.ReactNode;
}

const isEmpty = (v: React.ReactNode) => v === undefined || v === null || v === '';

const UiDetail: React.FC<IUiDetail> = ({ items, variant = 'rows', placeholder = '—' }) => {
  const visible = items.filter((it) => !it.hide);
  if (!visible.length) return null;

  return (
    <>
      <style jsx>{styles}</style>
      <div className={`ui-detail ui-detail--${variant}`}>
        {visible.map((it, i) => {
          const value = isEmpty(it.value) ? placeholder : it.value;
          return (
            <div className="ui-detail__row" key={i}>
              <span className="ui-detail__label">{it.label}</span>
              <span className="ui-detail__value">
                {it.link ? (
                  <a href={it.link} target="_blank" rel="noopener noreferrer">{value}</a>
                ) : (
                  value
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default UiDetail;
