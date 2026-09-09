// Relative Path: ./StreamListRow.tsx
import React from 'react';
import UiToggle from '@webstack/components/UiForm/components/UiToggle/UiToggle';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiCollapse from '@webstack/components/UiCollapse/UiCollapse';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
import { useNotification } from '@webstack/components/Notification/Notification';
import { getService } from '@webstack/common';
import { ActionState } from '../../../../hooks/useStreamPanel';
import { StreamStatus } from '../../../../hooks/useStreamStatus';
import IMemberService, { IUserStream } from '~/src/core/services/MemberService/IMemberService';
import { StreamLogs } from '../../../StreamLog/StreamLog';
import StreamProviderIcon from '../../../StreamProviderIcon/StreamProviderIcon';
import { useStreamListRowLabels } from './hooks/useStreamListRow';
import StreamListRowDetails from './views/StreamListRowDetails';
import styles from './StreamListRow.scss';

const serverUrl = String(process.env.NEXT_PUBLIC_PRODUCTION_SERVER?.trim());

interface StreamListRowProps {
    stream: IUserStream; state: ActionState; message?: string; status?: StreamStatus;
    onToggle: (stream: IUserStream, nextEnabled: boolean) => void;
    onDelete: (stream: IUserStream) => void;
    onHlsResolved?: (provider: string, hlsUrl: string, hlsResolvedAt: string | null) => void;
}

const StreamListRow: React.FC<StreamListRowProps> = ({
    stream, state, message, status, onToggle, onDelete, onHlsResolved,
}) => {
    const [now, setNow] = React.useState(() => Date.now());
    const [hlsRefreshing, setHlsRefreshing] = React.useState(false);
    const [hlsError, setHlsError] = React.useState<string | null>(null);
    // Local state to immediately reflect resolved HLS URL without waiting for parent refresh
    const [resolvedHlsUrl, setResolvedHlsUrl] = React.useState<string | null>(null);
    const [resolvedHlsAt, setResolvedHlsAt] = React.useState<string | null>(null);
    const memberService = React.useMemo(() => getService<IMemberService>('IMemberService'), []);
    const { openModal, closeModal } = useModal();
    const [, setNotification] = useNotification();

    const actionsDisabled = state === 'saving' || state === 'deleting';
    const missingCreds = !stream.serverUrl || !stream.streamKey;
    const lastSeen = stream.lastHeartbeat ? `Last heartbeat: ${stream.lastHeartbeat}` : 'No heartbeat yet';

    const { uptimeLabel, statusLabel, runtimeHint, hlsResolvedAgo } = useStreamListRowLabels({ stream, status, now });

    React.useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(id);
    }, []);

    const notify = React.useCallback((label: string, msg?: string, persistence = 2500) => {
        setNotification({ active: true, persistence, dismissable: true, list: [{ label, message: msg }] });
    }, [setNotification]);

    const copyToClipboard = React.useCallback(async (label: string, value?: string | null) => {
        const text = (value ?? '').trim();
        if (!text) { notify('Nothing to copy', `${label} is empty.`); return; }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (!ok) throw new Error('execCommand copy failed');
            }
            notify('Copied', `${label} copied to clipboard.`);
        } catch (err: any) {
            notify('Copy failed', err?.message || 'Clipboard unavailable in this context.');
        }
    }, [notify]);

    const handleRefreshHls = React.useCallback(async () => {
        setHlsRefreshing(true);
        setHlsError(null);
        try {
            const result = await memberService.resolveHls(stream.provider, stream.eventId, stream.userId || undefined, stream.id || undefined);
            // Update local state immediately so UI reflects the new HLS URL
            setResolvedHlsUrl(result.hlsUrl);
            setResolvedHlsAt(result.hlsResolvedAt);
            onHlsResolved?.(stream.provider, result.hlsUrl, result.hlsResolvedAt);
            if (result.live === false) {
                notify('HLS URL (cached)', 'Returned previously resolved URL — stream may not be live.');
            } else {
                notify('HLS URL Resolved', 'HLS URL has been updated.');
            }
        } catch (err: any) {
            const detail = err?.message || err?.detail || 'Failed to resolve HLS URL';
            setHlsError(detail);
            if (detail.includes('not live')) notify('Stream Offline', 'Not currently live.');
            else if (detail.includes('wait')) notify('Cooldown', detail);
            else notify('Error', detail);
        } finally { setHlsRefreshing(false); }
    }, [memberService, onHlsResolved, notify, stream.provider, stream.eventId, stream.userId, stream.id]);

    const handleDelete = () => {
        openModal({
            confirm: {
                title: 'Delete Stream?',
                body: `Delete stream config for "${stream.provider}"? This cannot be undone.`,
                statements: [
                    { label: 'Cancel', variant: 'flat', onClick: () => closeModal() },
                    { label: 'Delete Stream', variant: 'danger', onClick: () => { onDelete(stream); closeModal(); } },
                ],
            },
        });
    };

    const handleToggleChange = (e: any) => {
        const nextEnabled = Boolean(e?.target?.value);
        if (nextEnabled && missingCreds) { notify('Config incomplete', 'Server URL and Stream Key required.'); return; }
        onToggle(stream, nextEnabled);
    };

    const previewUrl = React.useMemo(() => {
        if (!stream.eventId) return null;
        let url = `${serverUrl}/streaming/user-streams/${encodeURIComponent(stream.provider || 'custom')}/preview?eventId=${encodeURIComponent(stream.eventId)}`;
        if (stream.id) url += `&streamId=${encodeURIComponent(stream.id)}`;
        return url;
    }, [stream.provider, stream.eventId, stream.id]);

    // Merge locally resolved HLS data with stream prop for immediate UI updates
    const effectiveHlsUrl = resolvedHlsUrl ?? stream.hlsUrl;
    const effectiveHlsResolvedAt = resolvedHlsAt ?? stream.hlsResolvedAt;
    const streamWithResolvedHls = React.useMemo(() => ({
        ...stream,
        hlsUrl: effectiveHlsUrl,
        hlsResolvedAt: effectiveHlsResolvedAt,
    }), [stream, effectiveHlsUrl, effectiveHlsResolvedAt]);

    // Recalculate hlsResolvedAgo with effective timestamp
    const effectiveHlsResolvedAgo = React.useMemo(() => {
        if (!effectiveHlsResolvedAt) return null;
        const parsed = Date.parse(effectiveHlsResolvedAt);
        if (Number.isNaN(parsed)) return null;
        const mins = Math.floor(Math.max(0, now - parsed) / 60_000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ${mins % 60}m ago`;
    }, [effectiveHlsResolvedAt, now]);

    return (
        <>
            <style jsx>{styles}</style>
            <UiCollapse label={<div className="d-flex justify-between s-w-100">
                <div className="d-flex g-6 align-center">
                    <StreamProviderIcon
                        provider={stream.provider || 'custom'}
                        userHandle={stream.userHandle || undefined}
                        providerActive={stream.enabled}
                    />
                    {stream.provider?.toUpperCase()}
                    {stream.websiteUrl && <UiButton variant="ghost" size="xs" traits={{ afterIcon: 'fa-arrow-up-right-from-square' }} onClick={() => window.open(stream.websiteUrl as string, '_blank', 'noopener')}>Open Source</UiButton>}
                </div>
                <div>{stream.enabled
                    ? <small className="stream-panel__uptime"><UiIcon width="10px" height="10px" icon="fas-circle" glow={status === 'live'} color={status === 'live' ? 'var(--red-30)' : status === 'running' ? 'var(--blue-30)' : status === 'error' ? 'var(--red-30)' : 'var(--yellow-30)'} /> {uptimeLabel}{status === 'spinning' && <UiIcon icon="spinner" />}</small>
                    : <small className="stream-panel__lastseen"><UiIcon icon="fas-circle" color="var(--gray-50)" /> {lastSeen}</small>}
                </div>
            </div>}>
                <div className="stream-panel__row">
                    <div className="stream-panel__actions">
                        <div className="stream-panel__toggle">
                            <UiToggle name={`${stream.provider}-enabled`} label="Enabled" value={Boolean(stream.enabled)} disabled={actionsDisabled} onChange={handleToggleChange} />
                            <span className={`stream-panel__status-pill stream-panel__status-pill--${status || 'unknown'}`}>{statusLabel}{status === 'spinning' && <UiIcon icon="spinner" />}</span>
                            {missingCreds && <small className="stream-panel__warning">Add Server URL and Stream Key to start</small>}
                        </div>
                        <div className="stream-panel__button stream-panel__delete"><UiIcon onClick={handleDelete} icon={actionsDisabled ? 'spinner' : 'fa-trash-can'} /></div>
                        {state !== 'idle' && <div className={`stream-panel__action-msg stream-panel__action-msg--${state}`}>{state === 'saving' ? 'Working...' : message || (state === 'deleting' ? 'Deleting...' : 'Action updated')}</div>}
                    </div>
                    <StreamLogs stream={stream} />
                    <StreamListRowDetails stream={streamWithResolvedHls} previewUrl={previewUrl} hlsResolvedAgo={effectiveHlsResolvedAgo} hlsRefreshing={hlsRefreshing} hlsError={hlsError} uptimeLabel={uptimeLabel} runtimeHint={runtimeHint} onCopyHls={() => copyToClipboard('HLS URL', effectiveHlsUrl)} onRefreshHls={handleRefreshHls} />
                </div>
            </UiCollapse>
        </>
    );
};

export default StreamListRow;