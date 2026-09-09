import React, { useState, useCallback, useMemo } from "react";
import type { RosterRow } from "@Canopy/hooks/useCanopy";
import styles from "./CanopyResizerContent.scss";
import CanopyPanel from "../CanopyPanel/controller/CanopyPanel";
import CanopyViewMonitor from "@Canopy/transmitter/views/CanopyView/views/CanopyViewMonitor/CanopyViewMonitor";
import CanopyOverlayControls from "@Canopy/transmitter/views/CanopyView/views/CanopyOverlayControls/controller/CanopyOverlayControls";
import CanopyView from "@Canopy/transmitter/views/CanopyView/controller";
import UiResizerLayout from "@webstack/layouts/UiResizerLayout/controller/UiResizerLayout";
import { useCanopyViewState } from "../../../hooks/useCanopyViewState";
import type { IButton } from "@webstack/components/UiForm/components/UiButton/UiButton";
import type { EventRow } from "../../../hooks/useCanopy";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import ToggleSwitch from "@webstack/components/UiForm/components/UiToggle/UiToggle";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";

type CanopyViewState = ReturnType<typeof useCanopyViewState>;

export interface CanopyResizerContentProps {
    current: EventRow | null;
    events: EventRow[];
    handleUserSelect: (evt: EventRow | null) => void;
    deleteEvent: (id?: string) => void;
    deletingId: string | null;
    loadEvents: () => Promise<void>;
    isMobile: boolean;
    viewId?: string;
    viewState: CanopyViewState;
}

/**
 * CanopyResizerContent - Extracted from Canopy.tsx for better separation of concerns.
 * Handles the main resizer layout with panel, monitor, and overlay controls.
 */
const CanopyResizerContent: React.FC<CanopyResizerContentProps> = ({
    current,
    events,
    handleUserSelect,
    deleteEvent,
    deletingId,
    loadEvents,
    isMobile,
    viewId,
    viewState,
}) => {
    const {
        eventId,
        overlays,
        meta,
        roster,
        showLive,
        onChangeShowLive,
        pushing,
        canPush,
        canUndo,
        onGoLive,
        onUndo,
        focusOverlay,
        selectedOverlayId,
        removeOverlay,
        reorderOverlays,
        addOverlay,
        updateOverlaySize,
        updateOverlayCrop,
        updateOverlayPosition,
        updateOverlay,
        duplicateOverlay,
        overlayTable,
    } = viewState;

    // Derive teamsOverride from roster so the preview monitor uses live score/place data
    const teamsFromRoster = useMemo(() => {
        if (!Array.isArray(roster) || !roster.length) return undefined;
        const sorted = [...roster].sort((a: any, b: any) => {
            const as = Number(a?.score ?? 0) || 0;
            const bs = Number(b?.score ?? 0) || 0;
            return as - bs;
        });
        return sorted.map((r: RosterRow, i: number) => {
            const vehicle = (r as any).vehicle_number != null ? String((r as any).vehicle_number) : undefined;
            const idStr = (r as any).id != null ? String((r as any).id) : undefined;
            return {
                id: idStr,
                vehicle_number: vehicle,
                name: (r as any).team_name,
                competitor: Array.isArray((r as any)?.competitors) ? (r as any).competitors[0]?.name ?? undefined : undefined,
                competitors: Array.isArray((r as any)?.competitors)
                    ? (r as any).competitors.map((c: any) => ({
                        id: c?.id,
                        name: c?.name ?? null,
                        role: c?.role ?? null,
                        position: typeof c?.position === 'number' ? c.position : (c?.position != null ? Number(c.position) : null),
                    }))
                    : undefined,
                color: typeof (r as any)?.color === 'string' ? (r as any).color : undefined,
                place: i + 1,
                score: Number((r as any)?.score ?? 0) || undefined,
            };
        });
    }, [roster]);

    // Track active view for overlay controls radio layout
    const [activeControlsView, setActiveControlsView] = useState<string>('event-overlays');

    // Wrapper to add overlay and switch to event-overlays view
    const handleAddOverlay = useCallback((type: string) => {
        addOverlay(type);
        setActiveControlsView('event-overlays');
    }, [addOverlay]);

    // Safe overlayTable with fallback to empty array
    const safeOverlayTable = useMemo(() =>
        Array.isArray(overlayTable) ? overlayTable : [],
        [overlayTable]
    );

    const resizerWindows = useMemo(() => {
        // Right side vertical layout (monitor + controls stacked)
        const rightSideWindows = [
            {
                id: 'monitor',
                defaultSize: isMobile ? 'auto' : '1fr',
                minSize: isMobile ? 0 : 300,
                // resizable: !isMobile,
                children: (
                    <>
                        <style jsx>{styles}</style>
                        <div className='canopy-resizer-content'>
                            <CanopyViewMonitor
                                eventId={eventId}
                                eventMeta={current ? {
                                    id: current.id,
                                    name: current.name,
                                    lat: current.lat,
                                    lng: current.lng,
                                    design_width: current.design_width,
                                    design_height: current.design_height,
                                } : null}
                                designWidth={current?.design_width ?? undefined}
                                designHeight={current?.design_height ?? undefined}
                                highlightOverlayId={selectedOverlayId || meta?.t}
                                roster={roster}
                                teamsOverride={teamsFromRoster}
                                showLive={showLive}
                                onDragUpdate={updateOverlayPosition}
                                onResizeOverlay={updateOverlaySize}
                                onCropOverlay={updateOverlayCrop}
                                onDeleteOverlay={removeOverlay}
                                onUpdateOverlay={updateOverlay}
                                onDuplicateOverlay={duplicateOverlay}
                            />
                        </div>
                    </>
                ),
            },
            {
                id: 'controls',
                defaultSize: isMobile ? 'auto' : '1fr',
                minSize: isMobile ? 0 : 200,
                resizable: !isMobile,
                children: (
                    <>
                        <style jsx>{styles}</style>
                        <div className="canopy-view">
                            <CanopyOverlayControls
                                current={current ? {
                                    id: String(current.id ?? ''),
                                    name: current.name ?? '',
                                    overlays: current.overlays ?? undefined,
                                    lat: current.lat,
                                    lng: current.lng,
                                } : null}
                                overlays={overlays}
                            />
                        </div>
                    </>
                ),
            },
        ];

        // Panel window configuration
        const panelWindow = {
            id: 'panel',
            defaultSize: isMobile ? '40%' : 650,
            minSize: isMobile ? 0 : 300,
            // maxSize: isMobile ? undefined : 600,
            resizable: !isMobile,
            children: (
                <CanopyPanel
                    current={current}
                />
            ),
        };

        // Right side window with nested resizer
        const rightSideWindow = {
            id: 'right-side',
            defaultSize: isMobile ? '60%' : '100%',
            minSize: isMobile ? 0 : 400,
            resizable: !isMobile,
            children: isMobile ? (<>
                <CanopyView
                    eventId={eventId}
                    isMobile={isMobile}
                    windows={rightSideWindows}
                />
            </>
            ) : (
                <CanopyView
                    eventId={eventId}
                    isMobile={isMobile}
                    windows={rightSideWindows}
                />
            ),
        };

        // Mobile: monitor first, then panel. Desktop: panel first, then monitor
        return isMobile
            ? [rightSideWindow]
            : [panelWindow, rightSideWindow];
    }, [
        isMobile,
        current,
        events,
        handleUserSelect,
        deleteEvent,
        deletingId,
        loadEvents,
        eventId,
        meta,
        roster,
        showLive,
        safeOverlayTable,
        focusOverlay,
        reorderOverlays,
        removeOverlay,
        handleAddOverlay,
        overlays,
        activeControlsView,
        selectedOverlayId,
        updateOverlaySize,
        updateOverlayCrop,
        updateOverlayPosition,
        updateOverlay,
        duplicateOverlay,
        teamsFromRoster,
    ]);

    return (
        <UiResizerLayout
            storageKey={eventId ? `canopy-resizer-${eventId}` : 'canopy-resizer-root'}
            layout={isMobile ? 'vertical' : 'horizontal'}
            minWindowSize={isMobile ? 0 : 300}
            gutterSize={6}
            windows={resizerWindows}
            className="canopy-resizer-layout"
        />
    );
};

export default CanopyResizerContent;
