import type { CSSProperties } from "react";
import type { DragState } from "./useDragHandlers";
import type { ResizeState } from "./useResizeHandlers";

/**
 * Apply drag/resize visual overrides on top of the base overlay style.
 * All percentage values are converted to absolute px based on dim.
 */
export function computeOverlayStyle(
    baseStyle: CSSProperties,
    opts: {
        dim: { w: number; h: number };
        isDragging: boolean;
        isResizing: boolean;
        dragState: DragState;
        resizeState: ResizeState;
    }
): CSSProperties {
    let style = baseStyle;

    if (opts.isDragging && opts.dragState?.currentX != null && opts.dragState?.currentY != null) {
        style = {
            ...baseStyle,
            left: `${(opts.dragState.currentX / 100) * opts.dim.w}px`,
            top: `${(opts.dragState.currentY / 100) * opts.dim.h}px`,
        };
    }

    if (opts.isResizing && opts.resizeState) {
        if (opts.resizeState.mode === 'crop') {
            const crop = opts.resizeState.currentCrop ?? opts.resizeState.initialCrop;
            const [t, b, l, r] = crop.map(v => Math.max(0, v));
            style = { ...style, clipPath: `inset(${t}% ${r}% ${b}% ${l}%)` };
        } else {
            const newW = opts.resizeState.currentW ?? opts.resizeState.initialW;
            const newH = opts.resizeState.currentH ?? opts.resizeState.initialH;
            const newX = opts.resizeState.currentOvX ?? opts.resizeState.initialOvX;
            const newY = opts.resizeState.currentOvY ?? opts.resizeState.initialOvY;
            style = {
                ...style,
                width: `${(newW / 100) * opts.dim.w}px`,
                height: `${(newH / 100) * opts.dim.h}px`,
                left: `${(newX / 100) * opts.dim.w}px`,
                top: `${(newY / 100) * opts.dim.h}px`,
            };
        }
    }

    return style;
}
