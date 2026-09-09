import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./CanopyMedia.scss";
import { useCanopyMediaEngine } from "../../../engine/useCanopyMediaEngine";
import type { UseCanopyMediaEngineProps } from "../../../engine/types";
import { useTwitchDimensions } from "../functions/useTwitchDimensions";
import { useDragHandlers } from "../functions/useDragHandlers";
import { useResizeHandlers } from "../functions/useResizeHandlers";
import { computeOverlayStyle } from "../functions/computeOverlayStyle";
import CanopyMediaTools from "../views/CanopyMediaTools/CanopyMediaTools";
const serverUrl = String(process.env.NEXT_PUBLIC_PRODUCTION_SERVER?.trim() || '');

type CanopyMediaProps = UseCanopyMediaEngineProps & {
  highlightOverlayId?: string | number;
  onDragUpdate?: (id: string, x: number, y: number) => void;
  onResizeUpdate?: (id: string, width: number, height: number, x?: number, y?: number) => void;
  onCropUpdate?: (id: string, crop: [number, number, number, number]) => void;
  onDeleteOverlay?: (id: string) => void;
  onUpdateOverlay?: (id: string, partial: Record<string, any>) => void;
  onDuplicateOverlay?: (id: string) => void;
};

const CanopyMedia: React.FC<CanopyMediaProps> = (props) => {
  const surfaceRef = useRef<HTMLDivElement>(null);

  const dim = useTwitchDimensions({
    designWidth: props.designWidth,
    designHeight: props.designHeight,
    eventId: props.eventId,
  });

  const { dragState, handlePointerDown, handlePointerMove, handlePointerUp } = useDragHandlers({
    onDragUpdate: props.onDragUpdate,
    surfaceRef,
  });

  const { resizeState, handleResizePointerDown, handleResizePointerMove, handleResizePointerUp } = useResizeHandlers({
    onResizeUpdate: props.onResizeUpdate,
    onCropUpdate: props.onCropUpdate,
    surfaceRef,
  });

  const { containerRef, scale, present, renderOverlay, getItemStyle, renderablesCount, debugInfo, status } = useCanopyMediaEngine({
    ...props,
    designWidth: dim.w,
    designHeight: dim.h,
  });

  const [toolsHidden, setToolsHidden] = useState(false);
  useEffect(() => {
    if (props.source !== 'local') return;
    const onDown = (e: Event) => {
      const node = containerRef.current;
      if (!node) return;
      setToolsHidden(!node.contains(e.target as Node));
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [props.source, containerRef]);

  const surfaceStyle = useMemo(() => ({
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: "center center",
    width: `${dim.w}px`,
    height: `${dim.h}px`,
    "--design-w": `${dim.w}px`,
    "--design-h": `${dim.h}px`,
  }), [scale, dim.w, dim.h]);

  const wrapperStyle = useMemo(() => ({
    aspectRatio: `${dim.w} / ${dim.h}`,
    width: "100%",
  }), [dim.w, dim.h]);

  const handleOverlayClick = useCallback((ov: any) => {
    if (ov?.id && props.source === 'local') {
      window.dispatchEvent(new CustomEvent("canopy:focus-overlay", { detail: { id: ov.id } }));
    }
    props.onOverlayClick?.(ov);
  }, [props]);

  return (
    <>
      <style jsx>{styles}</style>
      <div
        ref={containerRef}
        className="ui-media-overlay"
        data-fullscreen={props.fullScreen ? "true" : "false"}
        style={props.fullScreen ? undefined : wrapperStyle}
      >
        <div ref={surfaceRef} className="ui-media-overlay__surface" style={surfaceStyle}>
          {(typeof window !== 'undefined' && ((window as any).__CANOPY_DEBUG__ || process.env.NEXT_PUBLIC_CANOPY_DEBUG === '1')) && (
            <div style={{ position: 'absolute', left: 8, top: 8, zIndex: 99999, fontFamily: 'monospace', fontSize: 12, color: '#0ff', background: 'rgba(0,0,0,0.5)', padding: '6px 8px', borderRadius: 4 }}>
              <div>source: {String(debugInfo?.source ?? '')}</div>
              <div>list: {debugInfo?.listCount ?? 0} | enabled: {debugInfo?.enabledCount ?? 0}</div>
              <div>groups s:{debugInfo?.groups?.scoreboards ?? 0} t:{debugInfo?.groups?.ticker ?? 0} m:{debugInfo?.groups?.maps ?? 0} o:{debugInfo?.groups?.other ?? 0}</div>
            </div>
          )}
          {renderablesCount === 0 && (
            <>
              <img
                src={`${serverUrl}/files/srv/mb1/canopy/cam_notice_background.jpg`}
                alt=""
                className='ui-media-overlay--empty'
              />
              {!props.suppressEmptyPlaceholder && (
                <div className="ui-media-overlay__empty">
                  {status?.source === 'server'
                    ? (status?.connecting ? 'Connecting to live overlays…' : 'No live overlays')
                    : 'no overlays'}
                </div>
              )}
            </>
          )}

          {(status?.source === 'server' && (status?.connecting || status?.isStale)) && (
            <div className="ui-media-overlay__status">
              {status.connecting ? 'Connecting…' : `Live overlays stale (${Math.round((status.ageMs || 0) / 1000)}s)`}
            </div>
          )}

          {present.map(({ ov, key, state }) => {
            const t = String((ov as any)?.type || "").toLowerCase();
            const variant = String((ov as any)?.variant ?? "default");
            const isHighlighted = props.source === "local"
              && props.highlightOverlayId != null
              && String((ov as any)?.id) === String(props.highlightOverlayId);
            const isDragging = dragState?.id === (ov as any)?.id;
            const isResizing = resizeState?.id === (ov as any)?.id;
            const isCropping = isResizing && resizeState?.mode === 'crop';
            const isDraggable = props.source === 'local' && props.onDragUpdate && (ov as any)?.data?.aspectPreset !== 'fullscreen';
            const isResizable = props.source === 'local' && props.onResizeUpdate && (ov as any)?.data?.aspectPreset !== 'fullscreen';

            const style = computeOverlayStyle(getItemStyle(ov, state), {
              dim,
              isDragging: !!isDragging,
              isResizing: !!isResizing,
              dragState,
              resizeState,
            });

            return (
              <div
                key={key}
                className={`ui-media-overlay__item ui-media-overlay__item--${t}`}
                data-variant={variant}
                data-animation={(ov as any)?.animation ?? "none"}
                data-highlighted={isHighlighted ? "true" : "false"}
                data-tools={isHighlighted && !toolsHidden ? "true" : "false"}
                data-dragging={isDragging ? "true" : "false"}
                data-resizing={isResizing ? "true" : "false"}
                data-cropping={isCropping ? "true" : "false"}
                style={{
                  ...style,
                  cursor: isDraggable ? 'move' : 'pointer',
                  touchAction: isDraggable ? 'none' : 'auto',
                }}
                draggable={false}
                onClick={() => ov && handleOverlayClick(ov)}
                onPointerDown={(e) => isDraggable && handlePointerDown(e, ov)}
                onPointerMove={(e) => {
                  handlePointerMove(e);
                  handleResizePointerMove(e);
                }}
                onPointerUp={(e) => {
                  handlePointerUp(e);
                  handleResizePointerUp(e);
                }}
                onPointerCancel={(e) => {
                  handlePointerUp(e);
                  handleResizePointerUp(e);
                }}
              >
                {isHighlighted && props.source === 'local' && !toolsHidden && (
                  <CanopyMediaTools
                    ov={ov}
                    itemStyle={style}
                    surfaceRef={surfaceRef}
                    isResizable={!!isResizable}
                    onUpdateOverlay={props.onUpdateOverlay}
                    onDuplicateOverlay={props.onDuplicateOverlay}
                    onDeleteOverlay={props.onDeleteOverlay}
                    onResizePointerDown={handleResizePointerDown}
                  />
                )}

                {renderOverlay(ov)}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default CanopyMedia;
