
// Relative Path: ./UiSliderLayout.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./UiSliderLayout.scss";
import useLocalStorage from "@webstack/hooks/storage/useLocalStorage";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import useWindow from "@webstack/hooks/window/useWindow";

type ClassValue = string | undefined | null;

type UiSliderLayoutState = {
    isDesktop: boolean;
    panelWidth: number;
    visiblePanelWidth: number;
    panelHidden: boolean;
    isDragging: boolean;
    showPanel: boolean;
    togglePanel: () => void;
    revealPanel: () => void;
    collapsePanel: () => void;
};

type UiSliderLayoutProps = {
    renderPanel: (state: UiSliderLayoutState) => React.ReactNode;
    renderContent: (state: UiSliderLayoutState) => React.ReactNode;
    renderMobileToggle?: (state: UiSliderLayoutState) => React.ReactNode;
    storageKey?: string;
    initialWidth?: number;
    minWidth?: number;
    maxWidth?: number;
    absoluteMaxWidth?: number;
    hideThreshold?: number;
    dismissWidth?: number;
    peekWidth?: number;
    desktopBreakpoint?: number;
    viewportWidth?: number | null;
    className?: ClassValue | ((state: UiSliderLayoutState) => ClassValue);
    panelClassName?: ClassValue | ((state: UiSliderLayoutState) => ClassValue);
    contentClassName?: ClassValue | ((state: UiSliderLayoutState) => ClassValue);
    handleAriaLabel?: string;
    handleIcon?: React.ReactNode;
    onWidthPersist?: (width: number) => void;
    vertical?: boolean;
};

const DEFAULT_MIN = 350;
const DEFAULT_MAX = 750;
const DEFAULT_ABS_MAX = 1600;
const DEFAULT_HIDE_THRESHOLD = 350;
const DEFAULT_DISMISS = 350;
const DEFAULT_PEEK = 28;
const DEFAULT_WIDTH = 750;

const resolveClassName = (
    value: UiSliderLayoutProps["className"],
    state: UiSliderLayoutState
): string | undefined => {
    if (typeof value === "function") return value(state) ?? undefined;
    return value ?? undefined;
};

const computePanelMax = (
    viewportWidth: number | null | undefined,
    minWidth: number,
    absMaxWidth: number,
    fallbackMax: number
): number => {
    if (!viewportWidth || viewportWidth <= 0) return fallbackMax;
    const usableWidth = Math.max(viewportWidth - 320, minWidth + 40);
    return Math.min(absMaxWidth, Math.max(usableWidth, minWidth));
};

const clampPanelWidth = (value: number, minWidth: number, maxWidth: number, peekWidth: number): number =>
    Math.min(Math.max(value, peekWidth), Math.max(peekWidth, maxWidth));

const UiSliderLayout: React.FC<UiSliderLayoutProps> = ({
    renderPanel,
    renderContent,
    renderMobileToggle,
    storageKey,
    initialWidth = DEFAULT_WIDTH,
    minWidth = DEFAULT_MIN,
    maxWidth = DEFAULT_MAX,
    absoluteMaxWidth = DEFAULT_ABS_MAX,
    hideThreshold = DEFAULT_HIDE_THRESHOLD,
    dismissWidth = DEFAULT_DISMISS,
    peekWidth = DEFAULT_PEEK,
    // desktopBreakpoint = DEFAULT_BREAKPOINT,
    viewportWidth,
    className,
    panelClassName,
    contentClassName,
    handleAriaLabel = "Resize panel",
    handleIcon,
    onWidthPersist,
    vertical = false,
}) => {
    const { getLocalItem, setLocalItem } = useLocalStorage(storageKey ?? "ui-slider-layout");
    // const isDesktop = viewportWidth == null ? true : viewportWidth > desktopBreakpoint;
    const { width } = useWindow();
    const isDesktop = width && width > 1100 || false;
    const panelMax = useMemo(
        () => computePanelMax(isDesktop ? viewportWidth : null, minWidth, absoluteMaxWidth, maxWidth),
        [absoluteMaxWidth, isDesktop, maxWidth, minWidth, viewportWidth]
    );

    const clampWidth = useCallback(
        (value: number) => clampPanelWidth(value, minWidth, panelMax, peekWidth),
        [minWidth, panelMax, peekWidth]
    );

    const storedWidth = useMemo(() => {
        if (!storageKey) return undefined;
        const value = getLocalItem?.(storageKey);
        if (typeof value === "number") return value;
        if (typeof value === "object" && value && "panelWidth" in value) {
            const maybe = (value as any).panelWidth;
            if (typeof maybe === "number") return maybe;
        }
        return undefined;
    }, [getLocalItem, storageKey]);

    const [panelWidth, setPanelWidth] = useState(() => clampWidth(storedWidth ?? initialWidth));
    const [panelHidden, setPanelHidden] = useState(false);
    const [showPanel, setShowPanel] = useState(isDesktop);
    const [isDragging, setIsDragging] = useState(false);

    const panelWidthRef = useRef(panelWidth);
    const startXRef = useRef(0);
    const startWidthRef = useRef(panelWidth);
    const draggingRef = useRef(false);
    const pendingDragRef = useRef(false);
    const lastExpandedWidthRef = useRef(Math.max(panelWidth, minWidth));
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        panelWidthRef.current = panelWidth;
    }, [panelWidth]);

    useEffect(() => {
        const clamped = clampWidth(panelWidthRef.current);
        panelWidthRef.current = clamped;
        setPanelWidth(clamped);
    }, [clampWidth]);

    useEffect(() => {
        if (!isDesktop) {
            setPanelHidden(true);
            setShowPanel(false);
            return;
        }
        setShowPanel(true);
        // For vertical layouts, don't hide panel based on dismissWidth on initial load
        if (vertical) {
            setPanelHidden(false);
        } else {
            setPanelHidden(panelWidth <= dismissWidth);
        }
    }, [dismissWidth, isDesktop, panelWidth, vertical]);

    useEffect(() => {
        if (!storageKey || !setLocalItem) return;
        const stored = panelHidden ? Math.max(lastExpandedWidthRef.current, minWidth) : panelWidth;
        setLocalItem(storageKey, { panelWidth: stored });
    }, [minWidth, panelHidden, panelWidth, setLocalItem, storageKey]);

    useEffect(() => () => {
        if (animationFrameRef.current != null) {
            window.cancelAnimationFrame(animationFrameRef.current);
        }
    }, []);

    const stopAnimation = useCallback(() => {
        if (animationFrameRef.current != null) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    const animateToWidth = useCallback(
        (targetWidth: number) => {
            stopAnimation();
            const resolvedTarget = clampWidth(targetWidth);
            const startWidth = panelWidthRef.current;
            const delta = resolvedTarget - startWidth;
            const duration = 540;
            const startTime = typeof performance !== "undefined" ? performance.now() : 0;

            const step = (timestamp: number) => {
                const elapsed = timestamp - startTime;
                const progress = Math.min(1, Number(duration) === 0 ? 1 : elapsed / duration);
                const eased = 1 - Math.pow(1 - progress, 3);
                const nextWidth = clampWidth(startWidth + delta * eased);
                panelWidthRef.current = nextWidth;
                setPanelWidth(nextWidth);

                if (progress < 1) {
                    animationFrameRef.current = window.requestAnimationFrame(step);
                    return;
                }

                animationFrameRef.current = null;
                const shouldHide = nextWidth <= clampWidth(dismissWidth);
                const expanded = Math.max(nextWidth, minWidth);
                if (!shouldHide) {
                    lastExpandedWidthRef.current = expanded;
                }
                setPanelHidden(shouldHide);
                setShowPanel(!shouldHide);
                if (onWidthPersist) onWidthPersist(shouldHide ? Math.max(lastExpandedWidthRef.current, minWidth) : expanded);
            };

            animationFrameRef.current = window.requestAnimationFrame(step);
        },
        [clampWidth, dismissWidth, minWidth, onWidthPersist, stopAnimation]
    );

    const revealPanel = useCallback(() => {
        const target = Math.max(
            lastExpandedWidthRef.current,
            panelWidthRef.current,
            hideThreshold + 40,
            minWidth
        );
        animateToWidth(target);
    }, [animateToWidth, hideThreshold, minWidth]);

    const collapsePanel = useCallback(() => {
        animateToWidth(peekWidth);
    }, [animateToWidth, peekWidth]);

    const togglePanel = useCallback(() => {
        if (!isDesktop) {
            setShowPanel((prev) => !prev);
            setPanelHidden(false);
            return;
        }
        const dismissEdge = clampWidth(dismissWidth);
        const isHidden = panelHidden || panelWidthRef.current <= dismissEdge;
        if (isHidden) {
            revealPanel();
            return;
        }
        collapsePanel();
    }, [clampWidth, collapsePanel, dismissWidth, isDesktop, panelHidden, revealPanel]);

    const removeGlobalDragListenersRef = useRef<() => void>();

    const handlePointerMove = useCallback(
        (event: PointerEvent | MouseEvent | TouchEvent) => {
            if (!pendingDragRef.current || !isDesktop) return;
            const clientPos = vertical
                ? ((event as PointerEvent).clientY ??
                    (event as MouseEvent).clientY ??
                    (event as TouchEvent).touches?.[0]?.clientY ??
                    startXRef.current)
                : ((event as PointerEvent).clientX ??
                    (event as MouseEvent).clientX ??
                    (event as TouchEvent).touches?.[0]?.clientX ??
                    startXRef.current);
            const delta = clientPos - startXRef.current;
            if (!draggingRef.current && Math.abs(delta) < 1) return;
            if (!draggingRef.current) {
                draggingRef.current = true;
                setIsDragging(true);
                startWidthRef.current = Math.max(panelWidthRef.current, peekWidth);
            }
            const next = clampWidth(startWidthRef.current + delta);
            panelWidthRef.current = next;
            setPanelWidth(next);
            if (panelHidden && next > hideThreshold) {
                setPanelHidden(false);
                setShowPanel(true);
            }
            if (typeof event.preventDefault === "function") event.preventDefault();
        },
        [clampWidth, hideThreshold, isDesktop, panelHidden, peekWidth, vertical]
    );

    const handlePointerUp = useCallback(() => {
        if (!pendingDragRef.current) return;
        stopAnimation();
        const dragged = draggingRef.current;
        pendingDragRef.current = false;
        draggingRef.current = false;
        setIsDragging(false);
        if (!dragged) {
            removeGlobalDragListenersRef.current?.();
            togglePanel();
            return;
        }
        const clampedWidth = clampWidth(panelWidthRef.current);
        const dismissEdge = clampWidth(dismissWidth);
        const shouldHide = clampedWidth <= dismissEdge;
        const expandedWidth = Math.max(clampedWidth, minWidth);

        if (!shouldHide) {
            lastExpandedWidthRef.current = expandedWidth;
        }

        const nextWidth = shouldHide ? peekWidth : expandedWidth;
        const storedWidth = shouldHide ? Math.max(lastExpandedWidthRef.current, minWidth) : expandedWidth;
        setPanelWidth(nextWidth);
        panelWidthRef.current = nextWidth;
        setPanelHidden(shouldHide);
        setShowPanel(!shouldHide);
        if (onWidthPersist) onWidthPersist(storedWidth);
        window.getSelection()?.removeAllRanges();
        removeGlobalDragListenersRef.current?.();
    }, [clampWidth, dismissWidth, minWidth, onWidthPersist, peekWidth, stopAnimation, togglePanel]);

    const removeGlobalDragListeners = useCallback(() => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("mousemove", handlePointerMove as any);
        window.removeEventListener("mouseup", handlePointerUp as any);
        window.removeEventListener("touchmove", handlePointerMove as any);
        window.removeEventListener("touchend", handlePointerUp as any);
    }, [handlePointerMove, handlePointerUp]);

    removeGlobalDragListenersRef.current = removeGlobalDragListeners;

    const addGlobalDragListeners = useCallback(() => {
        const opts: AddEventListenerOptions = { passive: false };
        window.addEventListener("pointermove", handlePointerMove, opts);
        window.addEventListener("pointerup", handlePointerUp, opts);
        window.addEventListener("mousemove", handlePointerMove as any, opts);
        window.addEventListener("mouseup", handlePointerUp as any, opts);
        window.addEventListener("touchmove", handlePointerMove as any, opts);
        window.addEventListener("touchend", handlePointerUp as any, opts);
    }, [handlePointerMove, handlePointerUp]);

    const handlePointerDown = useCallback(
        (event: React.PointerEvent) => {
            if (!isDesktop) {
                togglePanel();
                return;
            }
            if (typeof event.preventDefault === "function") event.preventDefault();
            const clientPos = vertical ? (event.clientY ?? 0) : (event.clientX ?? 0);
            pendingDragRef.current = true;
            draggingRef.current = false;
            stopAnimation();
            setIsDragging(false);
            startXRef.current = clientPos;
            startWidthRef.current = clampWidth(panelWidth);
            setPanelHidden(false);
            setShowPanel(true);
            try {
                (event.currentTarget as HTMLElement | undefined)?.setPointerCapture?.(event.pointerId);
            } catch {
                /* ignore */
            }
            addGlobalDragListeners();
        },
        [addGlobalDragListeners, clampWidth, isDesktop, panelWidth, stopAnimation, togglePanel, vertical]
    );

    useEffect(
        () => () => {
            removeGlobalDragListenersRef.current?.();
        },
        []
    );

    const clampedPanelWidth = clampWidth(panelWidthRef.current);
    const shouldPeek = panelHidden && !isDragging;
    const visiblePanelWidth = isDesktop ? (shouldPeek ? peekWidth : clampedPanelWidth) : clampedPanelWidth;
    const overlayThreshold = isDesktop
        ? (viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 0)) / 2
        : 0;
    const overlayMode = isDesktop && overlayThreshold > 0 && visiblePanelWidth >= overlayThreshold;

    const gridStyle = isDesktop
        ? overlayMode
            ? (vertical ? { gridTemplateRows: "1fr" } : { gridTemplateColumns: "1fr" })
            : (vertical
                ? { gridTemplateRows: `minmax(0, ${visiblePanelWidth}px) 1fr` }
                : { gridTemplateColumns: `minmax(0, ${visiblePanelWidth}px) 1fr` })
        : undefined;

    const resetToDefaultWidth = useCallback(() => {
        const target = clampWidth(initialWidth);
        animateToWidth(target);
    }, [animateToWidth, clampWidth, initialWidth]);

    const handleContentClick = useCallback(() => {
        if (!isDesktop || isDragging) return;
        if (!overlayMode) return;
        resetToDefaultWidth();
    }, [isDesktop, isDragging, overlayMode, resetToDefaultWidth]);

    const panelStyle = isDesktop
        ? overlayMode
            ? (vertical
                ? {
                    position: "absolute" as const,
                    top: 0,
                    height: visiblePanelWidth,
                    minHeight: shouldPeek ? peekWidth : Math.min(minWidth, visiblePanelWidth),
                    opacity: 1,
                    pointerEvents: "auto" as const,
                    width: "100%",
                }
                : {
                    position: "absolute" as const,
                    top: 0,
                    width: visiblePanelWidth,
                    minWidth: shouldPeek ? peekWidth : Math.min(minWidth, visiblePanelWidth),
                    opacity: 1,
                    pointerEvents: "auto" as const,
                })
            : (vertical
                ? {
                    height: visiblePanelWidth,
                    maxHeight: "100%",
                    boxSizing: "border-box" as const,
                    minHeight: shouldPeek ? peekWidth : Math.min(minWidth, visiblePanelWidth),
                    opacity: 1,
                    width: "100%",
                }
                : {
                    width: visiblePanelWidth,
                    maxWidth: "100%",
                    boxSizing: "border-box" as const,
                    minWidth: shouldPeek ? peekWidth : Math.min(minWidth, visiblePanelWidth),
                    opacity: 1,
                })
        : undefined;

    const state: UiSliderLayoutState = {
        isDesktop,
        panelWidth: clampedPanelWidth,
        visiblePanelWidth,
        panelHidden,
        isDragging,
        showPanel,
        togglePanel,
        revealPanel,
        collapsePanel,
    };

    const resolvedContainerClass = [
        "ui-slider-layout",
        isDesktop ? "ui-slider-layout--desktop" : "ui-slider-layout--mobile",
        vertical ? "ui-slider-layout--vertical" : "ui-slider-layout--horizontal",
        panelHidden ? "ui-slider-layout--peek" : undefined,
        showPanel ? "ui-slider-layout--panel-open" : "ui-slider-layout--panel-closed",
        resolveClassName(className, state),
    ]
        .filter(Boolean)
        .join(" ");

    const resolvedPanelClass = [
        "ui-slider-layout__panel",
        panelHidden ? "ui-slider-layout__panel--hidden" : undefined,
        isDragging ? "ui-slider-layout__panel--dragging" : undefined,
        resolveClassName(panelClassName, state),
    ]
        .filter(Boolean)
        .join(" ");

    const resolvedContentClass = [
        "ui-slider-layout__view",
        resolveClassName(contentClassName, state),
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <>
            <style jsx>{styles}</style>
            <div className={resolvedContainerClass} style={isDesktop && gridStyle || undefined} data-panel-hidden={panelHidden}>
                {renderMobileToggle && renderMobileToggle(state)}
                <aside
                    className={resolvedPanelClass}
                    style={isDesktop && panelStyle || undefined}
                    data-peek={panelHidden}
                    data-open={showPanel}
                    data-desktop={isDesktop}
                    data-overlay={overlayMode}
                >
                    <div className="ui-slider-layout__panel-content">{renderPanel(state)}</div>
                    {isDesktop ? (
                        <div
                            className={`ui-slider-layout__handle-container ${panelHidden ? "ui-slider-layout__handle-container--peek" : ""}`}
                            onPointerDown={handlePointerDown}
                            role="presentation"
                            aria-label={handleAriaLabel}
                            aria-orientation={vertical ? "horizontal" : "vertical"}
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    togglePanel();
                                }
                            }}
                        />
                    ) : null}
                </aside>
                <section
                    className={resolvedContentClass}
                    data-desktop={isDesktop}
                    onClick={handleContentClick}
                >
                    {renderContent(state)}
                </section>
            </div>
        </>
    );
};

export type { UiSliderLayoutProps, UiSliderLayoutState };
export default UiSliderLayout;