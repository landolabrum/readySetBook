import React from 'react';
import { ActionState } from '../../../hooks/useStreamPanel';
import { StreamStatus } from '../../../hooks/useStreamStatus';
import { IUserStream } from '~/src/core/services/MemberService/IMemberService';
import { getStreamCompositeKey } from '../../../functions/streamFieldBuilders';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import UiToggle from '@webstack/components/UiForm/components/UiToggle/UiToggle';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
import StreamListRowDetails from '../views/StreamListRow/views/StreamListRowDetails';
import { useStreamListRowLabels } from '../views/StreamListRow/hooks/useStreamListRow';
import { getService } from '@webstack/common';
import IMemberService from '~/src/core/services/MemberService/IMemberService';
import { useNotification } from '@webstack/components/Notification/Notification';
import styles from './StreamList.scss';

const serverUrl = String(process.env.NEXT_PUBLIC_PRODUCTION_SERVER?.trim());

interface StreamListProps {
    userStreams: Record<string, IUserStream>;
    loadingUserStreams: boolean;
    statusMap: Record<string, StreamStatus>;
    actionState: Record<string, ActionState>;
    actionMessage: Record<string, string>;
    visibleProvider?: string | null;
    selectedStream?: IUserStream | null;
    onSelect?: (stream: IUserStream | null) => void;
    onToggle: (stream: IUserStream, nextEnabled: boolean) => void;
    onDelete: (stream: IUserStream) => void;
    onHlsResolved?: (provider: string, hlsUrl: string, hlsResolvedAt: string | null) => void;
}

const StreamList: React.FC<StreamListProps> = ({
    userStreams,
    loadingUserStreams,
    statusMap,
    actionState,
    actionMessage,
    visibleProvider,
    selectedStream,
    onSelect,
    onToggle,
    onDelete,
    onHlsResolved,
}) => {
    const [now, setNow] = React.useState(() => Date.now());
    const [hlsRefreshing, setHlsRefreshing] = React.useState(false);
    const [hlsError, setHlsError] = React.useState<string | null>(null);
    const memberService = React.useMemo(() => getService<IMemberService>('IMemberService'), []);
    const { openModal, closeModal } = useModal();
    const [, setNotification] = useNotification();

    React.useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(id);
    }, []);

    const notify = React.useCallback((label: string, msg?: string, persistence = 2500) => {
        setNotification({ active: true, persistence, dismissable: true, list: [{ label, message: msg }] });
    }, [setNotification]);

    const streams = React.useMemo(() => {
        const list = Object.values(userStreams || {});
        if (!visibleProvider) return list;
        const filtered = list.filter((stream) => stream.provider === visibleProvider);
        // If the filter yields nothing (e.g., transient provider mismatch), keep the full list to avoid blanking the view.
        return filtered.length ? filtered : list;
    }, [userStreams, visibleProvider]);

    // Get labels for selected stream
    const selectedStreamKey = selectedStream ? getStreamCompositeKey(selectedStream) : null;
    const selectedStatus = selectedStreamKey ? statusMap[selectedStreamKey] : undefined;
    const { uptimeLabel, runtimeHint, hlsResolvedAgo } = useStreamListRowLabels({
        stream: selectedStream || ({} as IUserStream),
        status: selectedStatus,
        now,
    });

    const previewUrl = React.useMemo(() => {
        if (!selectedStream?.eventId) return null;
        let url = `${serverUrl}/streaming/user-streams/${encodeURIComponent(selectedStream.provider || 'custom')}/preview?eventId=${encodeURIComponent(selectedStream.eventId)}`;
        if (selectedStream.id) url += `&streamId=${encodeURIComponent(selectedStream.id)}`;
        return url;
    }, [selectedStream?.provider, selectedStream?.eventId, selectedStream?.id]);

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
        if (!selectedStream?.enabled) { notify('Stream not enabled', 'Enable the stream first.'); return; }
        setHlsRefreshing(true);
        setHlsError(null);
        try {
            const result = await memberService.resolveHls(selectedStream.provider, selectedStream.eventId, selectedStream.userId || undefined);
            onHlsResolved?.(selectedStream.provider, result.hlsUrl, result.hlsResolvedAt);
            notify('HLS URL Resolved', 'HLS URL has been updated.');
        } catch (err: any) {
            const detail = err?.message || err?.detail || 'Failed to resolve HLS URL';
            setHlsError(detail);
            if (detail.includes('not live')) notify('Stream Offline', 'Not currently live.');
            else if (detail.includes('wait')) notify('Cooldown', detail);
            else notify('Error', detail);
        } finally { setHlsRefreshing(false); }
    }, [memberService, notify, onHlsResolved, selectedStream]);

    const handleDeleteClick = React.useCallback((stream: IUserStream) => {
        const displayName = getStreamCompositeKey(stream);
        openModal({
            confirm: {
                title: 'Delete Stream?',
                body: `Delete stream ptab "${displayName}"? This cannot be undone.`,
                statements: [
                    { label: 'Cancel', variant: 'flat', onClick: () => closeModal() },
                    { label: 'Delete Stream', variant: 'flat danger', onClick: () => { onDelete(stream); closeModal(); } },
                ],
            },
        });
    }, [closeModal, onDelete, openModal]);

    // Build table data with composite key as display name (all providers)
    const tableData = React.useMemo(() => {
        return streams.map((stream) => {
            const compositeKey = getStreamCompositeKey(stream);
            const streamKey = compositeKey;
            const state = actionState[streamKey] || 'idle';
            const status = statusMap[streamKey] || 'disabled';
            // const isSelected = selectedStream?.id === stream.id;

            return {
                _stream: stream, // Hidden: pass stream object for row click
                name: compositeKey,
                status: (
                    <span className={`stream-panel__status-pill stream-panel__status-pill--${status}`}>
                        {status === 'live' && <UiIcon width="8px" height="8px" icon="fas-circle" glow color="var(--green-30)" />}
                        {status === 'running' && <UiIcon width="8px" height="8px" icon="fas-circle" color="var(--blue-30)" />}
                        {status === 'spinning' && <UiIcon icon="spinner" />}
                        {status === 'error' && <UiIcon width="8px" height="8px" icon="fas-circle" color="var(--red-30)" />}
                        {status === 'stale' && <UiIcon width="8px" height="8px" icon="fas-circle" color="var(--yellow-30)" />}
                        {status === 'disabled' && <UiIcon width="8px" height="8px" icon="fas-circle" color="var(--gray-50)" />}
                        {' '}{status}
                    </span>
                ),
                provider: stream.provider || 'custom',
                runner: stream.containerHost || stream.selectedDeviceId || 'auto',
                enabled: (
                    <UiToggle
                        name={`${streamKey}-enabled`}
                        value={Boolean(stream.enabled)}
                        disabled={state === 'saving' || state === 'deleting'}
                        onChange={(e: any) => {
                            e.stopPropagation?.();
                            const nextEnabled = Boolean(e?.target?.value);
                            if (nextEnabled && (!stream.serverUrl || !stream.streamKey)) {
                                notify('Config incomplete', 'Server URL and Stream Key required.');
                                return;
                            }
                            onToggle(stream, nextEnabled);
                        }}
                    />
                ),
                actions: (
                    <div className="stream-panel__table-actions" onClick={(e) => e.stopPropagation()}>
                        <UiIcon
                            onClick={() => !Boolean(
                                state === 'saving' || state === 'deleting'
                            ) && handleDeleteClick(stream)}
                            icon={
                                state === 'deleting' ? 'spinner' : 'fa-trash-can'
                            } />

                    </div>
                ),
            };
        });
    }, [streams, actionState, statusMap, selectedStream?.id, notify, onToggle, handleDeleteClick]);

    const handleRowClick = React.useCallback((row: any) => {
        const stream = row?._stream as IUserStream;
        if (!stream || !onSelect) return;

        // Stabilize selection without clearing the list; keep selection when clicking the same row.
        if (selectedStream?.id === stream.id) return;
        onSelect(stream);
    }, [onSelect, selectedStream?.id]);

    if (!streams.length && !loadingUserStreams) {
        const emptyLabel = visibleProvider
            ? `No saved streams for ${visibleProvider}. Add one below.`
            : 'No saved streams';
        return (
            <>
                <style jsx>{styles}</style>
                <div className="stream-panel__list">
                    <div className="stream-panel__row stream-panel__row--empty">{emptyLabel}</div>
                </div>
            </>
        );
    }

    return (
        <>
            <style jsx>{styles}</style>
            <div className="stream-panel__list" >
                {/* Selected stream details shown above the table */}
                <AdapTable
                    data={tableData}
                    loading={loadingUserStreams}

                    onRowClick={handleRowClick}
                    options={{
                        tableTitle: ` ${visibleProvider ?? 'All Providers'} (${visibleProvider ? streams.filter(s => s.provider === visibleProvider).length : streams.length})`,
                        hoverable: true,
                        hideColumns: ['_stream'],
                    }}
                />
                {selectedStream && (
                    <div className="stream-panel__selected-details">
                        <div className="stream-panel__selected-header">
                            <h4>{getStreamCompositeKey(selectedStream)}</h4>
                            <UiIcon
                                icon='fa-broadcast-tower'
                                onClick={() => onSelect?.(null)}
                            />
                        </div>
                        <StreamListRowDetails
                            stream={selectedStream}
                            previewUrl={previewUrl}
                            hlsResolvedAgo={hlsResolvedAgo}
                            hlsRefreshing={hlsRefreshing}
                            hlsError={hlsError}
                            uptimeLabel={uptimeLabel}
                            runtimeHint={runtimeHint}
                            onCopyHls={() => copyToClipboard('HLS URL', selectedStream.hlsUrl)}
                            onRefreshHls={handleRefreshHls}
                        />
                    </div>
                )}


            </div>
        </>
    );
};

export default StreamList;
