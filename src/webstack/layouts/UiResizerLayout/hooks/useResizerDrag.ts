import { useCallback, useRef, useEffect } from 'react';
import { IResizerWindow } from '../components/UiResizerWindow';

interface DragState {
    gutterIndex: number;
    startPos: number;
    startSizes: [number, number];
    windowIds: [string, string];
    defaultSizes: [number, number]; // Track defaults for rebound
}

// Minimum percentage of default size before rebound kicks in
const REBOUND_THRESHOLD = 0.10; // 10%

export const useResizerDrag = (
    windows: IResizerWindow[],
    sizes: { [windowId: string]: number },
    updateSizes: (sizes: { [windowId: string]: number }) => void,
    setDraggingGutter: (index: number | null) => void,
    layout: 'horizontal' | 'vertical' | 'grid',
    minWindowSize: number = 100
) => {
    const dragState = useRef<DragState | null>(null);
    const rafRef = useRef<number | null>(null);
    const pendingUpdate = useRef<{ x: number; y: number } | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const reboundTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Helper to get default size from window config
    const getDefaultSize = useCallback((win: IResizerWindow, currentSize: number): number => {
        if (typeof win.defaultSize === 'number') return win.defaultSize;
        if (typeof win.defaultSize === 'string') {
            // For percentage or fr, use current size as approximation
            return currentSize;
        }
        return currentSize;
    }, []);

    // Smooth rebound animation
    const animateRebound = useCallback((
        windowId: string,
        fromSize: number,
        toSize: number,
        otherWindowId: string,
        otherFromSize: number,
        otherToSize: number,
        duration: number = 200
    ) => {
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic for smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 3);

            const newSize = fromSize + (toSize - fromSize) * eased;
            const newOtherSize = otherFromSize + (otherToSize - otherFromSize) * eased;

            updateSizes({
                ...sizes,
                [windowId]: newSize,
                [otherWindowId]: newOtherSize,
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [sizes, updateSizes]);

    const applyDrag = useCallback(() => {
        if (!pendingUpdate.current || !dragState.current) return;

        const { x, y } = pendingUpdate.current;
        const { gutterIndex, startPos, startSizes, windowIds, defaultSizes } = dragState.current;

        const currentPos = layout === 'horizontal' ? x : y;
        const delta = currentPos - startPos;

        const [beforeId, afterId] = windowIds;
        const [beforeStart, afterStart] = startSizes;
        const [beforeDefault, afterDefault] = defaultSizes;

        const beforeWindow = windows[gutterIndex];
        const afterWindow = windows[gutterIndex + 1];

        // Calculate new sizes with constraints
        let newBeforeSize = beforeStart + delta;
        let newAfterSize = afterStart - delta;

        const beforeMin = beforeWindow?.minSize || minWindowSize;
        const beforeMax = beforeWindow?.maxSize || Infinity;
        const afterMin = afterWindow?.minSize || minWindowSize;
        const afterMax = afterWindow?.maxSize || Infinity;

        // Clamp before window
        if (newBeforeSize < beforeMin) {
            newAfterSize += newBeforeSize - beforeMin;
            newBeforeSize = beforeMin;
        } else if (newBeforeSize > beforeMax) {
            newAfterSize += newBeforeSize - beforeMax;
            newBeforeSize = beforeMax;
        }

        // Clamp after window
        if (newAfterSize < afterMin) {
            newBeforeSize += newAfterSize - afterMin;
            newAfterSize = afterMin;
        } else if (newAfterSize > afterMax) {
            newBeforeSize += newAfterSize - afterMax;
            newAfterSize = afterMax;
        }

        // Final validation
        newBeforeSize = Math.max(beforeMin, Math.min(beforeMax, newBeforeSize));
        newAfterSize = Math.max(afterMin, Math.min(afterMax, newAfterSize));

        const newSizes = {
            ...sizes,
            [beforeId]: newBeforeSize,
            [afterId]: newAfterSize,
        };

        updateSizes(newSizes);
        pendingUpdate.current = null;
    }, [windows, sizes, layout, minWindowSize, updateSizes]);

    const handlePointerMove = useCallback(
        (e: PointerEvent) => {
            if (!dragState.current) return;

            e.preventDefault();

            pendingUpdate.current = { x: e.clientX, y: e.clientY };

            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(() => {
                    applyDrag();
                    rafRef.current = null;
                });
            }
        },
        [applyDrag]
    );

    const handlePointerUp = useCallback(
        (e: PointerEvent) => {
            if (!dragState.current) return;

            e.preventDefault();

            // Apply any pending drag update
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            if (pendingUpdate.current) {
                applyDrag();
            }

            // Check for rebound condition
            const { windowIds, defaultSizes } = dragState.current;
            const [beforeId, afterId] = windowIds;
            const [beforeDefault, afterDefault] = defaultSizes;

            const beforeCurrent = sizes[beforeId] || 0;
            const afterCurrent = sizes[afterId] || 0;

            const beforeThreshold = beforeDefault * REBOUND_THRESHOLD;
            const afterThreshold = afterDefault * REBOUND_THRESHOLD;

            // If either window is below 10% of its default, rebound to threshold
            if (beforeCurrent < beforeThreshold || afterCurrent < afterThreshold) {
                const totalSize = beforeCurrent + afterCurrent;
                let targetBefore = beforeCurrent;
                let targetAfter = afterCurrent;

                if (beforeCurrent < beforeThreshold) {
                    targetBefore = beforeThreshold;
                    targetAfter = totalSize - beforeThreshold;
                }
                if (afterCurrent < afterThreshold) {
                    targetAfter = afterThreshold;
                    targetBefore = totalSize - afterThreshold;
                }

                // Animate the rebound
                animateRebound(
                    beforeId, beforeCurrent, targetBefore,
                    afterId, afterCurrent, targetAfter,
                    180
                );
            }

            setDraggingGutter(null);
            dragState.current = null;
            pendingUpdate.current = null;

            // Clean up event listeners
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
        },
        [applyDrag, setDraggingGutter, sizes, animateRebound]
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>, gutterIndex: number) => {
            e.preventDefault();
            e.stopPropagation();

            const beforeWindow = windows[gutterIndex];
            const afterWindow = windows[gutterIndex + 1];

            if (!beforeWindow || !afterWindow) return;

            const startPos = layout === 'horizontal' ? e.clientX : e.clientY;
            const beforeSize = sizes[beforeWindow.id] || 0;
            const afterSize = sizes[afterWindow.id] || 0;

            // Get default sizes for rebound calculation
            const beforeDefault = getDefaultSize(beforeWindow, beforeSize);
            const afterDefault = getDefaultSize(afterWindow, afterSize);

            dragState.current = {
                gutterIndex,
                startPos,
                startSizes: [beforeSize, afterSize],
                windowIds: [beforeWindow.id, afterWindow.id],
                defaultSizes: [beforeDefault, afterDefault],
            };

            setDraggingGutter(gutterIndex);

            // Inline handlers with direct closure access
            const moveHandler = (evt: PointerEvent) => {
                if (!dragState.current) return;
                evt.preventDefault();

                const { gutterIndex: gIndex, startPos: sPos, startSizes, windowIds } = dragState.current;
                const currentPos = layout === 'horizontal' ? evt.clientX : evt.clientY;
                const delta = currentPos - sPos;

                const [beforeId, afterId] = windowIds;
                const [beforeStart, afterStart] = startSizes;

                const bWindow = windows[gIndex];
                const aWindow = windows[gIndex + 1];

                let newBeforeSize = beforeStart + delta;
                let newAfterSize = afterStart - delta;

                const beforeMin = bWindow?.minSize || minWindowSize;
                const beforeMax = bWindow?.maxSize || Infinity;
                const afterMin = aWindow?.minSize || minWindowSize;
                const afterMax = aWindow?.maxSize || Infinity;

                // Clamp sizes
                if (newBeforeSize < beforeMin) {
                    newAfterSize += newBeforeSize - beforeMin;
                    newBeforeSize = beforeMin;
                } else if (newBeforeSize > beforeMax) {
                    newAfterSize += newBeforeSize - beforeMax;
                    newBeforeSize = beforeMax;
                }

                if (newAfterSize < afterMin) {
                    newBeforeSize += newAfterSize - afterMin;
                    newAfterSize = afterMin;
                } else if (newAfterSize > afterMax) {
                    newBeforeSize += newAfterSize - afterMax;
                    newAfterSize = afterMax;
                }

                newBeforeSize = Math.max(beforeMin, Math.min(beforeMax, newBeforeSize));
                newAfterSize = Math.max(afterMin, Math.min(afterMax, newAfterSize));

                updateSizes({
                    ...sizes,
                    [beforeId]: newBeforeSize,
                    [afterId]: newAfterSize,
                });
            };

            const upHandler = (evt: PointerEvent) => {
                if (!dragState.current) return;
                evt.preventDefault();

                if (rafRef.current !== null) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }

                // Check for rebound on pointer up
                const { windowIds, defaultSizes } = dragState.current;
                const [beforeId, afterId] = windowIds;
                const [beforeDefault, afterDefault] = defaultSizes;

                const beforeCurrent = sizes[beforeId] || 0;
                const afterCurrent = sizes[afterId] || 0;

                const beforeThreshold = beforeDefault * REBOUND_THRESHOLD;
                const afterThreshold = afterDefault * REBOUND_THRESHOLD;

                if (beforeCurrent < beforeThreshold || afterCurrent < afterThreshold) {
                    const totalSize = beforeCurrent + afterCurrent;
                    let targetBefore = beforeCurrent;
                    let targetAfter = afterCurrent;

                    if (beforeCurrent < beforeThreshold) {
                        targetBefore = beforeThreshold;
                        targetAfter = totalSize - beforeThreshold;
                    }
                    if (afterCurrent < afterThreshold) {
                        targetAfter = afterThreshold;
                        targetBefore = totalSize - afterThreshold;
                    }

                    animateRebound(
                        beforeId, beforeCurrent, targetBefore,
                        afterId, afterCurrent, targetAfter,
                        180
                    );
                }

                setDraggingGutter(null);
                dragState.current = null;
                pendingUpdate.current = null;

                if (cleanupRef.current) {
                    cleanupRef.current();
                    cleanupRef.current = null;
                }
            };

            document.addEventListener('pointermove', moveHandler);
            document.addEventListener('pointerup', upHandler);

            cleanupRef.current = () => {
                document.removeEventListener('pointermove', moveHandler);
                document.removeEventListener('pointerup', upHandler);
            };
        },
        [windows, sizes, layout, setDraggingGutter, applyDrag, getDefaultSize, animateRebound, minWindowSize, updateSizes]
    );

    const handleKeyboardResize = useCallback(
        (gutterIndex: number, delta: number) => {
            const beforeWindow = windows[gutterIndex];
            const afterWindow = windows[gutterIndex + 1];

            if (!beforeWindow || !afterWindow) return;

            const beforeId = beforeWindow.id;
            const afterId = afterWindow.id;
            const beforeSize = sizes[beforeId] || 0;
            const afterSize = sizes[afterId] || 0;

            const beforeMin = beforeWindow.minSize || minWindowSize;
            const beforeMax = beforeWindow.maxSize || Infinity;
            const afterMin = afterWindow.minSize || minWindowSize;
            const afterMax = afterWindow.maxSize || Infinity;

            let newBeforeSize = beforeSize + delta;
            let newAfterSize = afterSize - delta;

            // Clamp to constraints
            newBeforeSize = Math.max(beforeMin, Math.min(beforeMax, newBeforeSize));
            newAfterSize = Math.max(afterMin, Math.min(afterMax, newAfterSize));

            // Ensure total size is preserved
            const total = beforeSize + afterSize;
            const newTotal = newBeforeSize + newAfterSize;
            if (Math.abs(newTotal - total) > 1) {
                const ratio = total / newTotal;
                newBeforeSize *= ratio;
                newAfterSize *= ratio;
            }

            const newSizes = {
                ...sizes,
                [beforeId]: newBeforeSize,
                [afterId]: newAfterSize,
            };

            updateSizes(newSizes);
        },
        [windows, sizes, minWindowSize, updateSizes]
    );

    return {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleKeyboardResize,
    };
};