// Relative Path: ./CanopyViewMonitor.tsx
import React, { useMemo } from 'react';
import styles from './CanopyViewMonitor.scss';
import type { RosterRow } from '@Canopy/hooks/useCanopy';

import CanopyMedia from '@Canopy/receiver/components/CanopyMedia/controller/CanopyMedia';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { usePipeline } from '../../../../../../Pipeline/context/PipelineProvider';
import UiLoader from '@webstack/components/UiLoader/view/UiLoader';

type Props = {
    eventId?: string;
    eventMeta?: Record<string, any> | null;
    /**
     * Teams list mapped from roster; passed straight through to CanopyMedia.
     * Kept intentionally loose to avoid tight coupling to DB row shape.
     */
    teamsOverride?: any[];
    /** Overlay id to highlight in the local preview surface. */
    highlightOverlayId?: string | null;
    roster?: RosterRow[] | null;
    /** Whether to render the server/live preview. */
    showLive?: boolean;
    /** Callback to update overlay position (x, y as % of design surface) */
    onDragUpdate?: (id: string, x: number, y: number) => void;
    /** Callback to update overlay size (w, h as % of design surface; optional x, y for corner resize) */
    onResizeOverlay?: (id: string, width: number, height: number, x?: number, y?: number) => void;
    /** Callback to update overlay crop ([top, bottom, left, right] as % of design surface) */
    onCropOverlay?: (id: string, crop: [number, number, number, number]) => void;
    /** Callback to delete an overlay */
    onDeleteOverlay?: (id: string) => void;
    /** Callback to update arbitrary overlay fields (z_index, enabled, etc.) */
    onUpdateOverlay?: (id: string, partial: Record<string, any>) => void;
    /** Callback to duplicate an overlay */
    onDuplicateOverlay?: (id: string) => void;
    /** Event design surface width (px). Controls the CanopyMedia canvas aspect ratio. */
    designWidth?: number;
    /** Event design surface height (px). Controls the CanopyMedia canvas aspect ratio. */
    designHeight?: number;
};

type ScoreboardTeam = {
    id?: number;
    name?: string;
    competitor?: string;
    competitors?: Array<{ id?: string; name?: string | null; role?: string | null; position?: number | null }>;
    place?: number;
    color?: string;
};

const CanopyViewMonitor: React.FC<Props> = ({
    eventId,
    eventMeta,
    teamsOverride,
    highlightOverlayId,
    showLive = false,
    onDragUpdate,
    onResizeOverlay,
    onCropOverlay,
    onDeleteOverlay,
    onUpdateOverlay,
    onDuplicateOverlay,
    designWidth,
    designHeight,
}) => {
    const { stream: pipelineStream, session: pipelineSession, hlsUrl: pipelineHlsUrl, getStreamForSession } = usePipeline();


    return (
        <>
            <style jsx>{styles}</style>

            <div className={`canopy-view__display ${showLive ? 'canopy-view__display--dual' : 'canopy-view__display--single'}`}>
                {eventId ? (
                    <>
                        <section className="alsv__local" aria-label="local-preview">
                            <legend>local preview</legend>
                            <CanopyMedia
                                fullScreen={false}
                                eventId={eventId}
                                eventMeta={eventMeta}
                                source="local"
                                designWidth={designWidth}
                                designHeight={designHeight}
                                highlightOverlayId={highlightOverlayId ?? undefined}
                                teamsOverride={teamsOverride}
                                localPipelineStream={pipelineStream ?? undefined}
                                pipelineSessionId={pipelineSession?.id}
                                pipelineHlsUrl={pipelineHlsUrl}
                                getStreamForSession={getStreamForSession}
                                onDragUpdate={onDragUpdate}
                                onResizeUpdate={onResizeOverlay}
                                onCropUpdate={onCropOverlay}
                                onDeleteOverlay={onDeleteOverlay}
                                onUpdateOverlay={onUpdateOverlay}
                                onDuplicateOverlay={onDuplicateOverlay}
                            />
                        </section>

                        {showLive && (
                            <section className="alsv__server" aria-label="server-preview">
                                <legend>live <UiIcon icon="fas-circle" /></legend>
                                <CanopyMedia
                                    fullScreen={false}
                                    eventId={eventId}
                                    eventMeta={eventMeta}
                                    source="server"
                                    designWidth={designWidth}
                                    designHeight={designHeight}
                                    pollMs={15000}
                                    useSSE
                                    teamsOverride={teamsOverride}
                                    suppressEmptyPlaceholder
                                    pipelineSessionId={pipelineSession?.id}
                                    pipelineHlsUrl={pipelineHlsUrl}
                                    getStreamForSession={getStreamForSession}
                                />
                            </section>
                        )}
                    </>
                ) : (
                    <UiLoader text="No event selected" />
                )}
            </div>
        </>
    );
};

export default CanopyViewMonitor;