import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';
import { overlayFieldsFor } from '@Canopy/models/canopyOverlayTypes';
import { useShareSession } from '../../hooks/useShareSession';
import { PipelineLogs } from '../PipelineLogs/PipelineLogs';
import PullSourceInput from './views/PullSourceInput';
import PullStreamStatus from './views/PullStreamStatus';
import { usePullStreamStatus } from './hooks/usePullStreamStatus';

type Props = {
    overlay: CanonOverlay;
    showingAdvancedFields?: boolean;
    onChange: (e: any) => void;
};

const CanopyPullControls: React.FC<Props> = ({ overlay, showingAdvancedFields, onChange }) => {
    const ctx = useShareSession({ overlay, onChange });
    const [pullSourceUrl, setPullSourceUrl] = useState<string>(() => ((overlay as any)?.data?.sourceUrl ?? '') as string);
    const [localError, setLocalError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const hlsPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const clearHlsPoller = useCallback(() => {
        if (hlsPollerRef.current) { clearInterval(hlsPollerRef.current); hlsPollerRef.current = null; }
    }, []);
    useEffect(() => () => clearHlsPoller(), [clearHlsPoller]);
    useEffect(() => { if (!ctx.busy) setPending(false); }, [ctx.busy]);

    const streamStatus = usePullStreamStatus(ctx.effectiveSessionId || undefined);

    const handleStart = useCallback(async () => {
        setLocalError(null);
        if (!pullSourceUrl.trim()) { setLocalError('Enter a source URL (rtmp://, srt://, or https://)'); return; }
        setPending(true);
        ctx.userStartedStreamRef.current = true;
        clearHlsPoller();
        try {
            if (ctx.isLinkedToActiveSession && ctx.session?.id) {
                try { await ctx.stop(); } catch { /* best-effort */ }
            }
            onChange({ target: { name: 'data.sourceUrl', value: pullSourceUrl.trim() } });
            const newSession = typeof ctx.startPull === 'function' ? await ctx.startPull(pullSourceUrl.trim()) : null;

            if (newSession?.id) {
                const targetId = newSession.id;
                hlsPollerRef.current = setInterval(async () => {
                    try {
                        const refreshed = await ctx.getSession(targetId);
                        const url = refreshed?.hlsUrl ?? (refreshed as any)?.meta?.hlsUrl ?? (refreshed as any)?.meta?.hls_url;
                        if (url) { clearHlsPoller(); onChange({ target: { name: 'data.src', value: url } }); }
                    } catch { /* ignore transient errors */ }
                }, 3000);
                setTimeout(clearHlsPoller, 60_000);
            }
        } catch (err: any) {
            ctx.userStartedStreamRef.current = false;
            setLocalError(err?.message ?? 'Unable to start pull session');
        }
    }, [ctx, pullSourceUrl, onChange, clearHlsPoller]);

    const handleStop = useCallback(async () => {
        setLocalError(null);
        clearHlsPoller();
        await ctx.stop();
    }, [ctx, clearHlsPoller]);

    const isRemoteLive = ctx.isRemoteSession && !!ctx.effectiveSrc;
    const displayError = localError || ctx.pipelineError;

    const fields = useMemo(() => {
        const base = overlayFieldsFor('pull', overlay, { showAdvancedFields: showingAdvancedFields });
        return base.map((f) => {
            if (f.name === 'data.pipelineSessionId') return { ...f, value: ctx.effectiveSessionId };
            if (f.name === 'data.src') return { ...f, value: ctx.effectiveSrc };
            if (f.name === 'data.sourceUrl') return { ...f, value: pullSourceUrl };
            return f;
        });
    }, [overlay, showingAdvancedFields, ctx.effectiveSessionId, ctx.effectiveSrc, pullSourceUrl]);

    return (
        <>
            <div style={{ fontSize: 11, marginBottom: 6, color: '#888' }}>
                <span style={{ opacity: 0.82 }}>{ctx.shareSourceLabel}</span>
                {ctx.sessionLabel && <span style={{ opacity: 0.6, marginLeft: 8 }}>{ctx.sessionLabel}</span>}
            </div>

            <PullSourceInput
                value={pullSourceUrl}
                onChange={setPullSourceUrl}
                onPull={handleStart}
                onStop={handleStop}
                busy={ctx.busy}
                pending={pending}
                isPullActive={ctx.isPullActive}
                isLinkedToActiveSession={ctx.isLinkedToActiveSession}
                isRemoteLive={isRemoteLive}
                hasError={!!displayError}
            />

            <PullStreamStatus
                sessionId={ctx.effectiveSessionId || undefined}
                status={streamStatus}
                isRemote={isRemoteLive}
            />

            {displayError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{displayError}</div>
            )}

            <UiForm title="Pull Stream" fields={fields} onChange={onChange} />

            {ctx.effectiveSessionId && (
                <PipelineLogs sessionId={ctx.effectiveSessionId} pollIntervalMs={5000} maxLines={8} />
            )}
        </>
    );
};

export default CanopyPullControls;
