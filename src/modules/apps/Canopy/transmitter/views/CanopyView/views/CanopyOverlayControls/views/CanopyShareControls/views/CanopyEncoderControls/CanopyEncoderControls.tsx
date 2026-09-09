/**
 * CanopyEncoderControls – transmitter panel for the "encoder" overlay type.
 * Handles RTMP/SRT encoder push sessions with connection info display.
 * No local media capture — the stream is pushed from an external encoder
 * (OBS, YoloBox, Kiloview, etc.).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';
import { overlayFieldsFor } from '@Canopy/models/canopyOverlayTypes';
import { useShareSession } from '../../hooks/useShareSession';
import { PipelineLogs } from '../PipelineLogs/PipelineLogs';
import CanopyEncoderConnectionPanel from './CanopyEncoderConnectionPanel';

type Props = {
    overlay: CanonOverlay;
    showingAdvancedFields?: boolean;
    onChange: (e: any) => void;
};

const CanopyEncoderControls: React.FC<Props> = ({ overlay, showingAdvancedFields, onChange }) => {
    const ctx = useShareSession({ overlay, onChange });
    const [pending, setPending] = useState(false);

    useEffect(() => { if (!ctx.busy) setPending(false); }, [ctx.busy]);

    const handleStart = useCallback(async () => {
        setPending(true);
        ctx.userStartedStreamRef.current = true;
        try {
            if (ctx.isLinkedToActiveSession && ctx.session?.id) {
                try { await ctx.stop(); } catch { /* best-effort */ }
            }
            if (typeof ctx.startRtmp === 'function') {
                await ctx.startRtmp(undefined, {
                    userId: ctx.userId || undefined,
                    streamId: ctx.eventIdStr || undefined,
                    overlayId: ctx.overlayId || undefined,
                });
            } else {
                await ctx.start('rtmp', null as any);
            }
        } catch (err: any) {
            ctx.userStartedStreamRef.current = false;
        }
    }, [ctx]);

    const handleStopClick = useCallback(async () => {
        await ctx.stop();
    }, [ctx]);

    const displayError = ctx.pipelineError;
    const isRemoteLive = ctx.isRemoteSession && !!ctx.effectiveSrc;
    const hasBoundPlayback = !!(ctx.effectiveSessionId && ctx.effectiveSrc && ctx.streamKey);
    const isEncoderSessionActive = ctx.isRtmpActive || hasBoundPlayback || isRemoteLive;
    const sessionLabel = isEncoderSessionActive
        ? `Pipeline rtmp - ${ctx.effectiveSessionId}`
        : ctx.sessionLabel;

    const fields = useMemo(() => {
        const base = overlayFieldsFor('encoder', overlay, { showAdvancedFields: showingAdvancedFields });
        const meta = ctx.isLinkedToActiveSession ? ((ctx.session as any)?.meta || {}) : {};
        const overlayMeta = (overlay as any)?.data || {};
        return base.map((field) => {
            if (field.name === 'data.pipelineSessionId') return { ...field, value: ctx.effectiveSessionId };
            if (field.name === 'data.src') return { ...field, value: ctx.effectiveSrc };
            if (field.name === 'data.rtmpIngestUrl') return { ...field, value: (ctx.isLinkedToActiveSession ? meta?.rtmpIngestUrl : overlayMeta?.rtmpIngestUrl) ?? '' };
            if (field.name === 'data.streamKey') return { ...field, value: (ctx.isLinkedToActiveSession ? meta?.streamKey : overlayMeta?.streamKey) ?? '' };
            return field;
        });
    }, [overlay, showingAdvancedFields, ctx.effectiveSessionId, ctx.effectiveSrc, ctx.isLinkedToActiveSession, ctx.session]);

    return (
        <>
            <div className="form__hint" style={{ marginBottom: 6 }}>
                Accept <b>RTMP/SRT push</b> from an external encoder (OBS, YoloBox, Kiloview, etc.). The overlay binds to the HLS playback automatically.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12, opacity: 0.82 }}>{ctx.shareSourceLabel}</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{sessionLabel}</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <UiButton
                    size="sm"
                    variant={isEncoderSessionActive ? 'success' : (ctx.busy && pending) ? 'spinner' : displayError ? 'warning' : 'link'}
                    traits={{ afterIcon: 'fa-broadcast-tower' }}
                    disabled={ctx.busy}
                    onClick={handleStart}
                >
                    Encoder Push
                </UiButton>
                <UiButton
                    size="sm"
                    variant={(isEncoderSessionActive || ctx.isLinkedToActiveSession) ? 'ghost' : 'disabled'}
                    traits={{ afterIcon: 'fa-stop' }}
                    disabled={!isEncoderSessionActive && !ctx.isLinkedToActiveSession}
                    onClick={handleStopClick}
                >
                    Stop
                </UiButton>
                <span style={{ fontSize: 12, color: '#666', alignSelf: 'center' }}>{ctx.shareStatusLabel}</span>
            </div>

            {displayError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{displayError}</div>
            )}

            {isEncoderSessionActive && ctx.streamKey && (
                <CanopyEncoderConnectionPanel
                    streamKey={ctx.streamKey}
                    lanRtmpUrl={ctx.lanRtmpUrl}
                    lanSrtUrl={ctx.lanSrtUrl}
                    lanHlsUrl={ctx.lanHlsUrl}
                    editingStreamKey={ctx.editingStreamKey}
                    editStreamKeyValue={ctx.editStreamKeyValue}
                    streamKeyError={ctx.streamKeyError}
                    setEditStreamKeyValue={ctx.setEditStreamKeyValue}
                    handleSaveStreamKey={ctx.handleSaveStreamKey}
                    handleCancelEditStreamKey={ctx.handleCancelEditStreamKey}
                    handleEditStreamKey={ctx.handleEditStreamKey}
                    copyToClipboard={ctx.copyToClipboard}
                />
            )}

            <div style={{ fontSize: 12, color: '#888', margin: '4px 0 10px 0' }}>
                {isEncoderSessionActive && ctx.resolvedPlayableUrl
                    ? '✅ Stream connected! Push Live to publish this overlay.'
                    : isEncoderSessionActive
                    ? '⏳ Waiting for encoder... Copy URLs above and configure your encoder.'
                    : 'Start Encoder Push to create the RTMP/SRT ingest session.'}
                {displayError && <span style={{ color: '#ef4444', marginLeft: 8 }}>{displayError}</span>}
            </div>

            <UiForm title="Encoder Push" fields={fields} onChange={onChange} />

            {ctx.effectiveSessionId && (
                <PipelineLogs sessionId={ctx.effectiveSessionId} pollIntervalMs={5000} maxLines={8} />
            )}
        </>
    );
};

export default CanopyEncoderControls;
