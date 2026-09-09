import { useState, useEffect, useCallback, useRef } from 'react';
import { IResizerWindow } from '../components/UiResizerWindow';

interface WindowSize {
    [windowId: string]: number;
}

interface CollapsedState {
    [windowId: string]: boolean;
}

export const useResizerState = (
    windows: IResizerWindow[],
    layout: 'horizontal' | 'vertical' | 'grid',
    containerSize: number,
    storageKey?: string,
    minWindowSize: number = 100
) => {
    const [sizes, setSizes] = useState<WindowSize>({});
    const [collapsedState, setCollapsedState] = useState<CollapsedState>({});
    const [draggingGutter, setDraggingGutter] = useState<number | null>(null);
    const persistTimeout = useRef<NodeJS.Timeout | null>(null);
    const initialized = useRef<boolean>(false);

    // Parse size value ("30%", "300", "1fr") to pixels
    const parseSizeToPixels = useCallback(
        (size: number | string | undefined, total: number): number => {
            if (typeof size === 'number') return size;
            if (typeof size === 'string') {
                if (size.endsWith('%')) {
                    const percent = parseFloat(size);
                    return (percent / 100) * total;
                }
                if (size.endsWith('px')) {
                    return parseFloat(size);
                }
                if (size.endsWith('fr')) {
                    // Handle fr units in a separate pass
                    return 0;
                }
            }
            return 0;
        },
        []
    );

    // Initialize sizes from defaultSize or localStorage
    const initializeSizes = useCallback(() => {
        let stored: WindowSize | null = null;

        // Load from localStorage if available
        if (storageKey) {
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) stored = JSON.parse(saved);
            } catch (e) { }
        }

        const newSizes: WindowSize = {};
        const frUnits: { [id: string]: number } = {};
        let totalFixed = 0;
        let totalFr = 0;

        // First pass: calculate fixed sizes and count fr units
        // console.log('🔧 [useResizerState] Initializing sizes, containerSize:', containerSize);
        windows.forEach((window, idx) => {
            const windowId = window.id;
            // console.log(`  Window[${idx}] id="${windowId}" defaultSize="${window.defaultSize}"`);

            if (stored && stored[windowId]) {
                newSizes[windowId] = stored[windowId];
                totalFixed += stored[windowId];
            } else if (window.defaultSize) {
                if (typeof window.defaultSize === 'string' && window.defaultSize.endsWith('fr')) {
                    const fr = parseFloat(window.defaultSize);
                    frUnits[windowId] = fr;
                    totalFr += fr;
                    // console.log(`    -> ${fr}fr unit`);
                } else {
                    const size = parseSizeToPixels(window.defaultSize, containerSize);
                    newSizes[windowId] = Math.max(size, window.minSize || minWindowSize);
                    totalFixed += newSizes[windowId];
                    // console.log(`    -> ${newSizes[windowId]}px`);
                }
            }
        });

        // Second pass: distribute remaining space to fr units
        if (totalFr > 0) {
            const remaining = Math.max(0, containerSize - totalFixed);
            const frSize = remaining / totalFr;
            // console.log(`  Fr units: remaining=${remaining}px, frSize=${frSize}px`);

            Object.entries(frUnits).forEach(([id, fr]) => {
                const calculatedSize = Math.max(frSize * fr, minWindowSize);
                // Prevent fr units from being larger than remaining space
                newSizes[id] = Math.min(calculatedSize, remaining);
                totalFixed += newSizes[id];
                // console.log(`    ${id}: ${newSizes[id]}px`);
            });
        }

        // Third pass: if no sizes set, distribute equally
        const unsetWindows = windows.filter(w => !newSizes[w.id]);
        if (unsetWindows.length > 0) {
            const remaining = Math.max(0, containerSize - totalFixed);
            const equalSize = remaining / unsetWindows.length;

            unsetWindows.forEach(window => {
                newSizes[window.id] = Math.max(equalSize, window.minSize || minWindowSize);
            });
        }

        // Ensure total size doesn't exceed container
        const totalSize = Object.values(newSizes).reduce((sum, size) => sum + size, 0);
        if (totalSize > containerSize) {
            // Scale down proportionally
            const scale = containerSize / totalSize;
            Object.keys(newSizes).forEach(id => {
                newSizes[id] = Math.max(newSizes[id] * scale, minWindowSize);
            });
        }

        // console.log('✅ Final sizes:', newSizes);
        setSizes(newSizes);
        initialized.current = true;

        // Initialize collapsed state
        const newCollapsed: CollapsedState = {};
        windows.forEach(window => {
            newCollapsed[window.id] = window.collapsed || false;
        });
        setCollapsedState(newCollapsed);
    }, [windows, containerSize, storageKey, minWindowSize, parseSizeToPixels]);

    // Initialize on mount or when windows/container changes
    useEffect(() => {
        if (!initialized.current && containerSize > 100) {
            initializeSizes();
        }
    }, [initializeSizes, containerSize]);

    // Recalculate sizes when container size changes (after initialization)
    useEffect(() => {
        if (!initialized.current || containerSize <= 100) return;

        const totalSize = Object.values(sizes).reduce((sum, size) => sum + size, 0);
        if (totalSize === 0) return;

        const sizeDelta = Math.abs(containerSize - totalSize);
        const changePercent = (sizeDelta / totalSize) * 100;

        // Only recalculate if change is significant (more than 5%)
        if (changePercent < 5) return;

        // console.log(`🔄 Container resized from ${totalSize}px to ${containerSize}px (${changePercent.toFixed(1)}% change)`);

        // Scale all windows proportionally to fit new container size
        const scale = containerSize / totalSize;
        const newSizes: WindowSize = {};

        Object.entries(sizes).forEach(([id, size]) => {
            const window = windows.find(w => w.id === id);
            const minSize = window?.minSize || minWindowSize;
            newSizes[id] = Math.max(size * scale, minSize);
            // console.log(`  ${id}: ${size}px -> ${newSizes[id]}px`);
        });

        setSizes(newSizes);
    }, [containerSize, sizes, windows, minWindowSize]);

    // Persist sizes to localStorage (debounced)
    const persistSizes = useCallback(
        (newSizes: WindowSize) => {
            if (!storageKey) return;

            if (persistTimeout.current) {
                clearTimeout(persistTimeout.current);
            }

            persistTimeout.current = setTimeout(() => {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(newSizes));
                } catch (e) {
                    console.warn('Failed to save resizer state to localStorage', e);
                }
            }, 300);
        },
        [storageKey]
    );

    const updateSizes = useCallback(
        (newSizes: WindowSize) => {
            setSizes(newSizes);
            persistSizes(newSizes);
        },
        [persistSizes]
    );

    const toggleCollapse = useCallback((windowId: string) => {
        setCollapsedState(prev => ({
            ...prev,
            [windowId]: !prev[windowId],
        }));
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (persistTimeout.current) {
                clearTimeout(persistTimeout.current);
            }
        };
    }, []);

    return {
        sizes,
        updateSizes,
        collapsedState,
        toggleCollapse,
        draggingGutter,
        setDraggingGutter,
    };
};
