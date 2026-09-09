/**
 * CanopyScreenControls – transmitter panel for the "screen" overlay type.
 * Handles getDisplayMedia() screen capture, local preview, and pipeline session linking.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';
import { overlayFieldsFor } from '@Canopy/models/canopyOverlayTypes';
import { useShareSession } from '../../hooks/useShareSession';
import { useAudioMeter } from '@webstack/hooks/audio/useAudioMeter';
import styles from './CanopyScreenControls.scss';
import PipelineService from '~/src/core/services/PipelineService/PipelineService';

type Props = {
    overlay: CanonOverlay;
    showingAdvancedFields?: boolean;
    onChange: (e: any) => void;
};

const CanopyScreenControls: React.FC<Props> = ({ overlay, showingAdvancedFields, onChange }) => {
    const ctx = useShareSession({ overlay, onChange });

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    useAudioMeter({ stream: localStream ?? undefined, overlayId: String((overlay as any)?.id ?? '') });

    const canShareScreen = useMemo(
        () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia,
        []
    );

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(() => { });
        } else if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
    }, [localStream]);

    const stopLocalStream = useCallback(() => {
        setLocalStream((prev) => {
            prev?.getTracks().forEach((t) => t.stop());
            return null;
        });
    }, []);

    useEffect(() => { if (!ctx.busy) setPending(false); }, [ctx.busy]);

    const handleStart = useCallback(() => {
        setLocalError(null);
        ctx.userStartedStreamRef.current = true;
        const overlayId = String((overlay as any)?.id ?? '');
        if (!overlayId) {
            setLocalError('Overlay must be saved before sharing.');
            return Promise.resolve();
        }
        const params = new URLSearchParams({ kind: 'screen', overlayId, autoStart: '1' });
        if (ctx.eventIdStr) params.set('eventId', ctx.eventIdStr);
        if (ctx.userId) params.set('userId', ctx.userId);
        const url = `/app/pipeline?${params.toString()}`;
        try {
            window.open(url, `pipeline-${overlayId}`, 'width=520,height=720');
        } catch (err: any) {
            setLocalError(err?.message ?? 'Unable to open publisher window');
        }
        return Promise.resolve();
    }, [ctx.eventIdStr, ctx.userStartedStreamRef, overlay]);

    const handleStopClick = useCallback(async () => {
        setLocalError(null);
        stopLocalStream();
        await ctx.stop();
    }, [ctx, stopLocalStream]);

    const [inviteBusy, setInviteBusy] = useState(false);
    const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
    const handleCopyInvite = useCallback(async () => {
        setInviteFeedback(null);
        setLocalError(null);
        const overlayId = String((overlay as any)?.id ?? '');
        if (!overlayId) {
            setLocalError('Overlay must be saved before generating an invite.');
            return;
        }
        setInviteBusy(true);
        try {
            const svc = new PipelineService();
            const created = await svc.createSession({
                kind: 'screen',
                require_token: true,
                userId: ctx.userId || undefined,
                streamId: ctx.eventIdStr || undefined,
                overlayId,
            });
            const token = created.sessionToken;
            if (!token) throw new Error('Server did not return an invite token.');
            const url = `${window.location.origin}/canopy/publish/${encodeURIComponent(token)}`;
            await navigator.clipboard?.writeText(url);
            setInviteFeedback('Invite link copied');
        } catch (err: any) {
            setLocalError(err?.message ?? 'Unable to create invite link');
        } finally {
            setInviteBusy(false);
        }
    }, [ctx.eventIdStr, ctx.userId, overlay]);

    const displayError = localError || ctx.pipelineError;
    const isRemoteLive = ctx.isRemoteSession && !!ctx.effectiveSrc;
    const isActive = (ctx.isLinkedToActiveSession && ctx.session?.kind === 'screen' && ctx.isPublishing) || isRemoteLive;
    const pendingShare = (overlay as any)?.data?._pendingShare === true;

    // Auto-trigger getDisplayMedia ONLY when a brand-new screen overlay is
    // added (_pendingShare flag).  Re-enabling a disabled overlay should NOT
    // re-prompt — the user may just be toggling visibility.
    const autoTriggeredRef = useRef(false);
    useEffect(() => {
        if (!pendingShare) return;
        if (autoTriggeredRef.current) return;
        if (!canShareScreen || ctx.busy) return;

        autoTriggeredRef.current = true;

        handleStart().then(() => {
            if (onChange) {
                onChange({ target: { name: 'data._pendingShare', value: undefined } });
            }
        }).catch(() => {
            autoTriggeredRef.current = false;
        });
    }, [pendingShare, canShareScreen, ctx.busy, handleStart, onChange]);

    const fields = useMemo(() => {
        const base = overlayFieldsFor('screen', overlay, { showAdvancedFields: showingAdvancedFields });
        return base.map((field) => {
            if (field.name === 'data.pipelineSessionId') return { ...field, value: ctx.effectiveSessionId };
            if (field.name === 'data.src') return { ...field, value: ctx.effectiveSrc };
            return field;
        });
    }, [overlay, showingAdvancedFields, ctx.effectiveSessionId, ctx.effectiveSrc]);

    return (
        <>
            <style jsx>{styles}</style>
            <div className="form__hint" style={{ marginBottom: 6 }}>
                Share your <b>screen</b> or a specific window. When a Pipeline session is active, this overlay automatically binds to its HLS stream.
            </div>

            <div className="screen-controls__source">
                <div className="screen-controls__source-info">
                    <span className="screen-controls__source-label">{ctx.shareSourceLabel}</span>
                    <span className="screen-controls__session-label">{ctx.sessionLabel}</span>
                </div>
            </div>

            <div className="screen-controls__actions">
                <UiButton
                    size="sm"
                    variant={!canShareScreen ? 'disabled' : isActive ? 'success' : (ctx.busy && pending) ? 'spinner' : displayError ? 'warning' : 'link'}
                    traits={{ afterIcon: 'fa-mobile-screen' }}
                    disabled={ctx.busy || !canShareScreen}
                    onClick={handleStart}
                >
                    Share screen
                </UiButton>
                <UiButton
                    size="sm"
                    variant={isActive ? 'ghost' : 'flat'}
                    traits={{ afterIcon: 'fa-stop' }}
                    onClick={handleStopClick}
                >
                    Stop
                </UiButton>
                <UiButton
                    size="sm"
                    variant={inviteBusy ? 'spinner' : 'link'}
                    traits={{ afterIcon: 'fa-link' }}
                    disabled={inviteBusy}
                    onClick={handleCopyInvite}
                >
                    Copy invite link
                </UiButton>
                <span className="screen-controls__status">{ctx.shareStatusLabel}</span>
            </div>

            {inviteFeedback && (
                <div className="screen-controls__error" style={{ color: '#10b981' }}>{inviteFeedback}</div>
            )}

            {displayError && (
                <div className="screen-controls__error">{displayError}</div>
            )}

            {localStream && (
                <div className="screen-controls__preview">
                    <div className={`screen-controls__preview-badge${ctx.publisherState === 'live' ? ' screen-controls__preview-badge--live' : ''}`}>
                        {ctx.publisherState === 'live' ? '● LIVE' : ctx.publisherState === 'publishing' ? 'Publishing...' : 'Local Preview'}
                    </div>
                    <video ref={localVideoRef} autoPlay playsInline muted className="screen-controls__preview-video" />
                </div>
            )}

            <UiForm title="Screen Share" fields={fields} onChange={onChange} />
        </>
    );
};

export default CanopyScreenControls;
