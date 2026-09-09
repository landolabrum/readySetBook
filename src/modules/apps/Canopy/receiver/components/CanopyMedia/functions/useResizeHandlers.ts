import { useCallback, useState } from "react";
import { clamp01 } from "../../../engine/utils";

export type ResizeState = {
    id: string;
    mode: 'resize' | 'crop';
    corner: 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    // resize mode
    initialW: number;
    initialH: number;
    initialOvX: number;
    initialOvY: number;
    currentW?: number;
    currentH?: number;
    currentOvX?: number;
    currentOvY?: number;
    // crop mode: [top, bottom, left, right] in %
    initialCrop: [number, number, number, number];
    currentCrop?: [number, number, number, number];
} | null;

interface UseResizeHandlersOpts {
    onResizeUpdate?: (id: string, width: number, height: number, x?: number, y?: number) => void;
    onCropUpdate?: (id: string, crop: [number, number, number, number]) => void;
    surfaceRef: React.RefObject<HTMLDivElement | null>;
}

const clampCrop = (v: number) => Math.max(0, Math.min(99, Math.round(v * 100) / 100));

export function useResizeHandlers({ onResizeUpdate, onCropUpdate, surfaceRef }: UseResizeHandlersOpts) {
    const [resizeState, setResizeState] = useState<ResizeState>(null);

    const handleResizePointerDown = useCallback((e: React.PointerEvent, ov: any, corner: 'nw' | 'ne' | 'sw' | 'se') => {
        const isCropMode = e.altKey && !!onCropUpdate;
        if (!isCropMode && !onResizeUpdate) return;

        e.preventDefault();
        e.stopPropagation();

        if (isCropMode) {
            const existing: [number, number, number, number] =
                Array.isArray(ov.crop) && ov.crop.length >= 4
                    ? [ov.crop[0], ov.crop[1], ov.crop[2], ov.crop[3]]
                    : [0, 0, 0, 0];
            setResizeState({
                id: ov.id,
                mode: 'crop',
                corner,
                startX: e.clientX,
                startY: e.clientY,
                initialW: 0,
                initialH: 0,
                initialOvX: 0,
                initialOvY: 0,
                initialCrop: existing,
            });
        } else {
            let initialW: number | undefined = typeof ov.width === 'number' && ov.width > 0 ? ov.width : undefined;
            let initialH: number | undefined = typeof ov.height === 'number' && ov.height > 0 ? ov.height : undefined;

            if (initialW == null || initialH == null) {
                const el = (e.target as HTMLElement)?.closest?.('.ui-media-overlay__item');
                if (el && surfaceRef.current) {
                    const surfaceRect = surfaceRef.current.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    if (initialW == null) initialW = (elRect.width / surfaceRect.width) * 100;
                    if (initialH == null) initialH = (elRect.height / surfaceRect.height) * 100;
                }
            }

            setResizeState({
                id: ov.id,
                mode: 'resize',
                corner,
                startX: e.clientX,
                startY: e.clientY,
                initialW: initialW ?? 20,
                initialH: initialH ?? 15,
                initialOvX: ov.x ?? 0,
                initialOvY: ov.y ?? 0,
                initialCrop: [0, 0, 0, 0],
            });
        }

        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [onResizeUpdate, onCropUpdate, surfaceRef]);

    const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
        if (!resizeState || !surfaceRef.current) return;

        const surfaceRect = surfaceRef.current.getBoundingClientRect();
        const pctDeltaX = ((e.clientX - resizeState.startX) / surfaceRect.width) * 100;
        const pctDeltaY = ((e.clientY - resizeState.startY) / surfaceRect.height) * 100;

        if (resizeState.mode === 'crop') {
            const [t, b, l, r] = resizeState.initialCrop;
            // Each corner drags two edges inward: nw→top+left, ne→top+right, sw→bottom+left, se→bottom+right
            // Dragging toward center increases crop; dragging outward decreases it
            let newT = t, newB = b, newL = l, newR = r;
            switch (resizeState.corner) {
                case 'nw': newT = clampCrop(t + pctDeltaY); newL = clampCrop(l + pctDeltaX); break;
                case 'ne': newT = clampCrop(t + pctDeltaY); newR = clampCrop(r - pctDeltaX); break;
                case 'sw': newB = clampCrop(b - pctDeltaY); newL = clampCrop(l + pctDeltaX); break;
                case 'se': newB = clampCrop(b - pctDeltaY); newR = clampCrop(r - pctDeltaX); break;
            }
            setResizeState(prev => prev ? { ...prev, currentCrop: [newT, newB, newL, newR] } : null);
        } else {
            let newW = resizeState.initialW;
            let newH = resizeState.initialH;
            let newX = resizeState.initialOvX;
            let newY = resizeState.initialOvY;
            switch (resizeState.corner) {
                case 'se':
                    newW = Math.max(2, resizeState.initialW + pctDeltaX);
                    newH = Math.max(2, resizeState.initialH + pctDeltaY);
                    break;
                case 'sw':
                    newW = Math.max(2, resizeState.initialW - pctDeltaX);
                    newH = Math.max(2, resizeState.initialH + pctDeltaY);
                    newX = clamp01(resizeState.initialOvX + pctDeltaX);
                    break;
                case 'ne':
                    newW = Math.max(2, resizeState.initialW + pctDeltaX);
                    newH = Math.max(2, resizeState.initialH - pctDeltaY);
                    newY = clamp01(resizeState.initialOvY + pctDeltaY);
                    break;
                case 'nw':
                    newW = Math.max(2, resizeState.initialW - pctDeltaX);
                    newH = Math.max(2, resizeState.initialH - pctDeltaY);
                    newX = clamp01(resizeState.initialOvX + pctDeltaX);
                    newY = clamp01(resizeState.initialOvY + pctDeltaY);
                    break;
            }
            setResizeState(prev => prev ? { ...prev, currentW: newW, currentH: newH, currentOvX: newX, currentOvY: newY } : null);
        }
    }, [resizeState, surfaceRef]);

    const handleResizePointerUp = useCallback((e: React.PointerEvent) => {
        if (!resizeState) return;

        if (resizeState.mode === 'crop' && onCropUpdate) {
            onCropUpdate(resizeState.id, resizeState.currentCrop ?? resizeState.initialCrop);
        } else if (resizeState.mode === 'resize' && onResizeUpdate) {
            const finalW = resizeState.currentW ?? resizeState.initialW;
            const finalH = resizeState.currentH ?? resizeState.initialH;
            const finalX = resizeState.currentOvX ?? resizeState.initialOvX;
            const finalY = resizeState.currentOvY ?? resizeState.initialOvY;
            onResizeUpdate(resizeState.id, finalW, finalH, finalX, finalY);
        }

        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        setResizeState(null);
    }, [resizeState, onResizeUpdate, onCropUpdate]);

    return { resizeState, handleResizePointerDown, handleResizePointerMove, handleResizePointerUp };
}
