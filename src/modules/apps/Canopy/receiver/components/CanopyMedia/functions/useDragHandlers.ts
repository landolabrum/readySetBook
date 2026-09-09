import { useCallback, useState } from "react";
import { clamp01 } from "../../../engine/utils";

export type DragState = {
    id: string;
    startX: number;
    startY: number;
    initialOvX: number;
    initialOvY: number;
    currentX?: number;
    currentY?: number;
} | null;

interface UseDragHandlersOpts {
    onDragUpdate?: (id: string, x: number, y: number) => void;
    surfaceRef: React.RefObject<HTMLDivElement | null>;
}

export function useDragHandlers({ onDragUpdate, surfaceRef }: UseDragHandlersOpts) {
    const [dragState, setDragState] = useState<DragState>(null);

    const handlePointerDown = useCallback((e: React.PointerEvent, ov: any) => {
        if (!onDragUpdate || ov?.data?.aspectPreset === 'fullscreen') return;

        e.preventDefault();
        e.stopPropagation();

        if (ov?.id) {
            window.dispatchEvent(new CustomEvent("canopy:focus-overlay", { detail: { id: ov.id } }));
        }

        setDragState({
            id: ov.id,
            startX: e.clientX,
            startY: e.clientY,
            initialOvX: ov.x ?? 0,
            initialOvY: ov.y ?? 0,
        });

        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [onDragUpdate]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragState || !surfaceRef.current) return;

        const surfaceRect = surfaceRef.current.getBoundingClientRect();
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;

        const pctDeltaX = (deltaX / surfaceRect.width) * 100;
        const pctDeltaY = (deltaY / surfaceRect.height) * 100;

        const newX = clamp01(dragState.initialOvX + pctDeltaX);
        const newY = clamp01(dragState.initialOvY + pctDeltaY);

        setDragState(prev => prev ? { ...prev, currentX: newX, currentY: newY } : null);
    }, [dragState, surfaceRef]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (dragState && onDragUpdate) {
            const finalX = dragState.currentX ?? dragState.initialOvX;
            const finalY = dragState.currentY ?? dragState.initialOvY;

            onDragUpdate(dragState.id, finalX, finalY);

            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            setDragState(null);
        }
    }, [dragState, onDragUpdate]);

    return { dragState, handlePointerDown, handlePointerMove, handlePointerUp };
}
