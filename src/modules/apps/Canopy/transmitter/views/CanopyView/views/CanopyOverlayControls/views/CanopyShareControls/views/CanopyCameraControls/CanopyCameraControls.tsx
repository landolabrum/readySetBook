/**
 * CanopyCameraControls – transmitter panel for the "camera" overlay type.
 * Handles getUserMedia() device selection, local preview, and pipeline session linking.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';
import { overlayFieldsFor } from '@Canopy/models/canopyOverlayTypes';
import { useShareSession } from '../../hooks/useShareSession';
import { useAudioMeter } from '@webstack/hooks/audio/useAudioMeter';
import CanopyCameraPreview from './CanopyCameraPreview';
import CanopyCameraDeviceSelectors from './CanopyCameraDeviceSelectors';
import PipelineService from '~/src/core/services/PipelineService/PipelineService';

type Props = {
    overlay: CanonOverlay;
    showingAdvancedFields?: boolean;
    onChange: (e: any) => void;
};

const CanopyCameraControls: React.FC<Props> = ({ overlay, showingAdvancedFields, onChange }) => {
    const ctx = useShareSession({ overlay, onChange });

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
    const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(undefined);
    const [selectedAudioId, setSelectedAudioId] = useState<string | undefined>(undefined);
    const [pending, setPending] = useState(false);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    useAudioMeter({ stream: localStream ?? undefined, overlayId: String((overlay as any)?.id ?? '') });

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(() => { });
        } else if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
    }, [localStream]);

    // Enumerate devices
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                if (!navigator?.mediaDevices?.enumerateDevices) return;
                const devices = await navigator.mediaDevices.enumerateDevices();
                if (cancelled) return;
                const vids = devices.filter((d) => d.kind === 'videoinput');
                const auds = devices.filter((d) => d.kind === 'audioinput');
                setVideoInputs(vids);
                setAudioInputs(auds);
                if (!selectedVideoId && vids[0]) setSelectedVideoId(vids[0].deviceId);
                if (!selectedAudioId && auds[0]) setSelectedAudioId(auds[0].deviceId);
            } catch { /* silent */ }
        };
        load();
        return () => { cancelled = true; };
    }, [selectedAudioId, selectedVideoId]);

    const stopLocalStream = useCallback(() => {
        setLocalStream((prev) => {
            prev?.getTracks().forEach((t) => t.stop());
            return null;
        });
    }, []);

    // Clear pending when pipeline finishes
    useEffect(() => { if (!ctx.busy) setPending(false); }, [ctx.busy]);

    const handleStart = useCallback(() => {
        setLocalError(null);
        ctx.userStartedStreamRef.current = true;
        const overlayId = String((overlay as any)?.id ?? '');
        if (!overlayId) {
            setLocalError('Overlay must be saved before sharing.');
            return;
        }
        const params = new URLSearchParams({ kind: 'camera', overlayId, autoStart: '1' });
        if (ctx.eventIdStr) params.set('eventId', ctx.eventIdStr);
        if (ctx.userId) params.set('userId', ctx.userId);
        const url = `/app/pipeline?${params.toString()}`;
        try {
            window.open(url, `pipeline-${overlayId}`, 'width=520,height=720');
        } catch (err: any) {
            setLocalError(err?.message ?? 'Unable to open publisher window');
        }
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
                kind: 'camera',
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
    const isActive = (ctx.isLinkedToActiveSession && ctx.session?.kind === 'camera' && ctx.isPublishing) || isRemoteLive;

    const fields = useMemo(() => {
        const base = overlayFieldsFor('camera', overlay, { showAdvancedFields: showingAdvancedFields });
        return base.map((field) => {
            if (field.name === 'data.pipelineSessionId') return { ...field, value: ctx.effectiveSessionId };
            if (field.name === 'data.src') return { ...field, value: ctx.effectiveSrc };
            return field;
        });
    }, [overlay, showingAdvancedFields, ctx.effectiveSessionId, ctx.effectiveSrc]);

    return (
        <>
            <div className="form__hint" style={{ marginBottom: 6 }}>
                Share your <b>camera</b>. When a Pipeline session is active, this overlay automatically binds to its HLS stream.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12, opacity: 0.82 }}>{ctx.shareSourceLabel}</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{ctx.sessionLabel}</span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <UiButton
                    size="sm"
                    variant={isActive ? 'success' : (ctx.busy && pending) ? 'spinner' : displayError ? 'warning' : 'link'}
                    traits={{ afterIcon: 'fa-camera-security' }}
                    disabled={ctx.busy}
                    onClick={handleStart}
                >
                    Share camera
                </UiButton>
                <UiButton
                    size="sm"
                    variant={isActive ? 'ghost' : 'disabled'}
                    traits={{ afterIcon: 'fa-stop' }}
                    disabled={!isActive && !ctx.isLinkedToActiveSession}
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
                <span style={{ fontSize: 12, color: '#666', alignSelf: 'center' }}>{ctx.shareStatusLabel}</span>
            </div>

            {inviteFeedback && (
                <div style={{ fontSize: 12, color: '#10b981', marginBottom: 8 }}>{inviteFeedback}</div>
            )}

            {displayError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{displayError}</div>
            )}

            {localStream && (
                <CanopyCameraPreview
                    localVideoRef={localVideoRef}
                    isLive={ctx.publisherState === 'live'}
                />
            )}

            <CanopyCameraDeviceSelectors
                videoInputs={videoInputs}
                audioInputs={audioInputs}
                selectedVideoId={selectedVideoId}
                selectedAudioId={selectedAudioId}
                onVideoChange={setSelectedVideoId}
                onAudioChange={setSelectedAudioId}
            />

            <UiForm title="Camera Share" fields={fields} onChange={onChange} />
        </>
    );
};

export default CanopyCameraControls;
