// Relative Path: ./UiResizerLayout.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './UiResizerLayout.scss';
import UiResizerWindow, { IResizerWindow } from '../components/UiResizerWindow';
import { useResizerState } from '../hooks/useResizerState';
import { useResizerDrag } from '../hooks/useResizerDrag';

interface IUiResizerLayout {
    windows: IResizerWindow[];
    layout?: 'horizontal' | 'vertical' | 'grid';
    gridTemplate?: string; // "2x2", "3x1"
    gutterSize?: number;
    storageKey?: string;
    onSizeChange?: (sizes: Record<string, number>) => void;
    minWindowSize?: number;
    className?: string;
}

const UiResizerLayout: React.FC<IUiResizerLayout> = ({
    windows,
    layout = 'horizontal',
    gutterSize = 3,
    storageKey,
    onSizeChange,
    minWindowSize = 100,
    className = '',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState(0);

    const {
        sizes,
        updateSizes,
        collapsedState,
        toggleCollapse,
        draggingGutter,
        setDraggingGutter,
    } = useResizerState(windows, layout, containerSize, storageKey, minWindowSize);

    const {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleKeyboardResize,
    } = useResizerDrag(
        windows,
        sizes,
        updateSizes,
        setDraggingGutter,
        layout,
        minWindowSize
    );

    // Measure container size
    useEffect(() => {
        const updateSize = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const size = layout === 'horizontal' ? rect.width : rect.height;
            setContainerSize(size);
        };

        updateSize();

        const resizeObserver = new ResizeObserver(() => {
            updateSize();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [layout]);

    // Notify parent of size changes
    useEffect(() => {
        if (onSizeChange) {
            onSizeChange(sizes);
        }
    }, [sizes, onSizeChange]);

    // Keyboard handler for gutter
    const handleGutterKeyDown = useCallback(
        (e: React.KeyboardEvent, gutterIndex: number) => {
            const key = e.key;
            const isHorizontal = layout === 'horizontal';
            const shiftMultiplier = e.shiftKey ? 4 : 1;
            const baseIncrement = 5;

            let delta = 0;

            if ((isHorizontal && key === 'ArrowRight') || (!isHorizontal && key === 'ArrowDown')) {
                delta = baseIncrement * shiftMultiplier;
            } else if ((isHorizontal && key === 'ArrowLeft') || (!isHorizontal && key === 'ArrowUp')) {
                delta = -baseIncrement * shiftMultiplier;
            }

            if (delta !== 0) {
                e.preventDefault();
                handleKeyboardResize(gutterIndex, delta);
            }
        },
        [layout, handleKeyboardResize]
    );

    // Calculate flex basis for windows as percentage of container
    const getWindowStyle = (windowId: string): React.CSSProperties => {
        const size = sizes[windowId] || 0;
        const isCollapsed = collapsedState[windowId];

        if (isCollapsed) {
            return {
                flexBasis: 'auto',
                flexShrink: 1,
                flexGrow: 0,
            };
        }

        // Calculate percentage of container
        const totalSize = Object.values(sizes).reduce((sum, s) => sum + s, 0);
        const percentage = totalSize > 0 ? (size / totalSize) * 100 : 0;
        // console.log(`📐 ${windowId}: ${size}px / ${totalSize}px = ${percentage.toFixed(2)}%`);

        if (layout === 'horizontal') {
            return {
                flexBasis: `${percentage}%`,
                minWidth: `${minWindowSize}px`,
                flexShrink: 0,
                flexGrow: 0,
            };
        } else {
            return {
                flexBasis: `${percentage}%`,
                minHeight: `${minWindowSize}px`,
                flexShrink: 0,
                flexGrow: 0,
            };
        }
    };

    return (
        <>
            <style jsx>{styles}</style>
            <div
                ref={containerRef}
                className={`ui-resizer-layout ui-resizer-layout--${layout} ${className}`}
                data-dragging={draggingGutter !== null}
            >
                {windows.map((window, index) => (
                    <React.Fragment key={window.id}>
                        <div
                            className="ui-resizer-layout__window-wrapper"
                            style={getWindowStyle(window.id)}
                            data-collapsed={collapsedState[window.id]}
                        >
                            <UiResizerWindow
                                {...window}
                                size={sizes[window.id] || 0}
                                isCollapsed={collapsedState[window.id] || false}
                                onToggleCollapse={() => toggleCollapse(window.id)}
                            />

                        </div>
                        {index < windows.length - 1 && window.resizable !== false && (
                            <div
                                className={`ui-resizer-layout__gutter ui-resizer-layout__gutter--${layout} ${draggingGutter === index ? 'ui-resizer-layout__gutter--dragging' : ''
                                    }`}
                                style={{
                                    [layout === 'horizontal' ? 'width' : 'height']: `${gutterSize}px`,
                                }}
                                onPointerDown={(e) => handlePointerDown(e, index)}
                                tabIndex={0}
                                role="separator"
                                aria-orientation={layout === 'horizontal' ? 'vertical' : 'horizontal'}
                                aria-label={`Resize between ${window.header?.title || `window ${index + 1}`} and ${windows[index + 1]?.header?.title || `window ${index + 2}`
                                    }`}
                                aria-valuenow={sizes[window.id]}
                                onKeyDown={(e) => handleGutterKeyDown(e, index)}
                            >
                                <div className="ui-resizer-layout__gutter-handle" />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </>
    );
};

export default UiResizerLayout;
export type { IUiResizerLayout, IResizerWindow };
``