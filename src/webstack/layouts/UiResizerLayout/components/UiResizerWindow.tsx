// Relative Path: ./UiResizerWindow.tsx
import React from 'react';
import styles from './UiResizerWindow.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiMarkdown from '@webstack/components/UiMarkDown/controller/UiMarkDown';

export interface IResizerWindow {
  id: string;
  children: React.ReactNode;
  defaultSize?: number | string; // 300, "30%", "1fr"
  minSize?: number; // pixels
  maxSize?: number; // pixels
  collapsible?: boolean;
  collapsed?: boolean;
  header?: {
    title?: string | React.ReactNode;
    actions?: React.ReactNode;
  };
  resizable?: boolean; // default true
  onCollapse?: () => void;
}

interface IUiResizerWindowProps extends IResizerWindow {
  size: number; // current size in pixels
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
}

const UiResizerWindow: React.FC<IUiResizerWindowProps> = ({
  id,
  children,
  header,
  collapsible = false,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <>
      <style jsx>{styles}</style>
      <div
        className={`ui-resizer-window ${isCollapsed ? 'ui-resizer-window--collapsed' : ''}`}
        data-window-id={id}
      >
        {header && (
          <div className="ui-resizer-window__header">
            <div className="ui-resizer-window__title">
              {typeof header.title === 'string' ? <UiMarkdown text={header.title }/> : 'header.title'}
            </div>
            <div className="ui-resizer-window__actions">
              {header.actions}
              {collapsible && (
                <button
                  type="button"
                  className="ui-resizer-window__collapse-btn"
                  onClick={onToggleCollapse}
                  aria-label={isCollapsed ? 'Expand window' : 'Collapse window'}
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  <UiIcon icon={isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="ui-resizer-window__content">
          {children}
        </div>
      </div>
    </>
  );
};

export default UiResizerWindow;
