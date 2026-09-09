import React, { useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import styles from './CanopyMediaTools.scss';
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import UiMultiSelectTags from "@webstack/components/UiForm/components/UiMultiSelect/views/UiMultiSelectTags";
import UiPill from '@webstack/components/UiForm/components/UiPill/UiPill';

interface CanopyMediaToolsProps {
  ov: any;
  itemStyle: React.CSSProperties;
  surfaceRef: React.RefObject<HTMLDivElement>;
  isResizable: boolean;
  onUpdateOverlay?: (id: string, partial: Record<string, any>) => void;
  onDuplicateOverlay?: (id: string) => void;
  onDeleteOverlay?: (id: string) => void;
  onResizePointerDown: (e: React.PointerEvent, ov: any, corner: 'nw' | 'ne' | 'sw' | 'se') => void;
}

const CanopyMediaTools: React.FC<CanopyMediaToolsProps> = ({
  ov,
  itemStyle,
  surfaceRef,
  isResizable,
  onUpdateOverlay,
  onDuplicateOverlay,
  onDeleteOverlay,
  onResizePointerDown,
}) => {
  const { openModal, closeModal } = useModal();

  const handleDeleteOverlay = useCallback(() => {
    if (!onDeleteOverlay || !ov?.id) return;

    const label = ov?.label || ov?.type || 'this overlay';

    openModal({
      title: `Delete Overlay`,
      confirm: {
        body: `Are you sure you want to delete "${label}"? This action cannot be undone.`,
        statements: [
          { label: 'Cancel', variant: 'flat', onClick: () => closeModal() },
          {
            label: 'Delete',
            variant: 'danger',
            onClick: () => {
              onDeleteOverlay(ov.id);
              closeModal();
            },
          },
        ],
      },
    });
  }, [onDeleteOverlay, ov, openModal, closeModal]);

  const id = ov?.id;
  const zIndex = typeof ov?.z_index === 'number' ? ov.z_index : 1;
  const enabled = ov?.enabled;

  // Determine toolbar placement based on overlay position and size within the surface
  const toolbarPlacement = useMemo(() => {
    const x = Number(ov?.x ?? 0);
    const y = Number(ov?.y ?? 0);
    const w = Number(ov?.width ?? 0);
    const h = Number(ov?.height ?? 0);

    // If the overlay is large enough that the toolbar would be clipped
    // outside the surface, place it inside (inset) instead.
    const topSpacePct = y;
    const bottomSpacePct = 100 - y - h;
    const needsInset = topSpacePct < 5 && bottomSpacePct < 5;

    const vEdge = needsInset ? 'inset-top' : (y < 20 ? 'bottom' : 'top');
    const hEdge = x > 50 ? 'right' : 'left';
    return `${vEdge}-${hEdge}` as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inset-top-left' | 'inset-top-right';
  }, [ov?.x, ov?.y, ov?.width, ov?.height]);

  // Toolbar + resize handles portal: rendered as a sibling of overlay items
  // inside the surface, so z-index competes directly with items instead of
  // being trapped inside the highlighted item's stacking context, and handles
  // aren't clipped by the surface's overflow:hidden.
  const toolbarPortal = useMemo(() => {
    if (!surfaceRef.current) return null;
    const { left, top, width, height, transform, zIndex: _omit, ...rest } = itemStyle;
    return ReactDOM.createPortal(
      <div
        className="ui-media-overlay__toolbar-anchor"
        style={{
          position: 'absolute',
          left, top, width, height, transform,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        <style jsx>{styles}</style>
        <div
          className={`ui-media-overlay__toolbar ui-media-overlay__toolbar--${toolbarPlacement}`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <UiMultiSelectTags
            direction="top"
            variant="flat"
            tags={[
              {
                tag: (
                  <div >
                    <UiPill
                    amount={zIndex}
                    setAmount={(value) => {
                      const newZ = Math.max(0, Math.min(9999, Number(value)));
                      console.log({newZ})
                      if (isNaN(newZ)) return;
                      onUpdateOverlay?.(id, { z_index: newZ });
                    }}
                    increment={1}
                    min={0}
                    showTrashAtMin={false}
                    hideBeforeIconAtMin
                    variant="flat"
                    />

                  </div>
                ),
                isActive: false,
              },
              {
                tag: (<UiIcon alt="duplicate" icon="fa-copy" />),
                isActive: false,
                onEdit: () => onDuplicateOverlay?.(id),
              },
              {
                tag: (
                  <>
                    <UiIcon alt={enabled ? 'Disable' : 'Enable'} icon={enabled ? 'fa-eye-slash' : 'fa-eye'}  />
                    {/* {enabled ? 'Disable' : 'Enable'} */}
                  </>
                ),
                isActive: !enabled,
                onEdit: () => onUpdateOverlay?.(id, { enabled: !enabled }),
                onRemove: () => { },
              },
              {
                tag: (
                  <>
                    <UiIcon alt="Delete" icon="fa-trash-can"  />
                  </>
                ),
                isActive: false,
                onEdit: () => handleDeleteOverlay(),
                onRemove: () => { },
              },
            ]}
            onEdit={() => { }}
          />
        </div>

        {/* Resize handles — inside the portal anchor so they aren't clipped */}
        {isResizable && (
          <>
            <div
              className="ui-media-overlay__resize-handle ui-media-overlay__resize-handle--nw"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(e) => { e.stopPropagation(); onResizePointerDown(e, ov, 'nw'); }}
            />
            <div
              className="ui-media-overlay__resize-handle ui-media-overlay__resize-handle--ne"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(e) => { e.stopPropagation(); onResizePointerDown(e, ov, 'ne'); }}
            />
            <div
              className="ui-media-overlay__resize-handle ui-media-overlay__resize-handle--sw"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(e) => { e.stopPropagation(); onResizePointerDown(e, ov, 'sw'); }}
            />
            <div
              className="ui-media-overlay__resize-handle ui-media-overlay__resize-handle--se"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(e) => { e.stopPropagation(); onResizePointerDown(e, ov, 'se'); }}
            />
          </>
        )}
      </div>,
      surfaceRef.current
    );
  }, [surfaceRef, itemStyle, toolbarPlacement, id, zIndex, enabled, isResizable, ov, onUpdateOverlay, onDuplicateOverlay, handleDeleteOverlay, onResizePointerDown, styles]);

  return (
    <>
      <style jsx>{styles}</style>
      {toolbarPortal}
    </>
  );
};

export default CanopyMediaTools;