// Relative Path: ./StreamListRowDetails.tsx
import React from 'react';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiList from '@webstack/components/UiList/UiList';
import UiMedia from '@webstack/components/UiMedia/controller/UiMedia';
import { IUserStream } from '~/src/core/services/MemberService/IMemberService';
import StreamProviderIcon from '../../../../StreamProviderIcon/StreamProviderIcon';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import styles from "./StreamListRowDetails.scss";
import UiLoader from '@webstack/components/UiLoader/view/UiLoader';
interface LogEntry {
    ts: string;
    msg: string;
}

interface StreamListRowDetailsProps {
    stream: IUserStream;
    previewUrl: string | null;
    hlsResolvedAgo: string | null;
    hlsRefreshing: boolean;
    hlsError: string | null;
    uptimeLabel: string | null;
    runtimeHint: string | null;
    onCopyHls: () => void;
    onRefreshHls: () => void;
}

// Parse FFmpeg progress from log message
const parseFFmpegProgress = (msg: string): { time?: string; bitrate?: string; fps?: string; frame?: string } | null => {
    const timeMatch = msg.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
    const bitrateMatch = msg.match(/bitrate=(\d+\.?\d*kbits\/s)/);
    const fpsMatch = msg.match(/fps=\s*(\d+)/);
    const frameMatch = msg.match(/frame=\s*(\d+)/);

    if (timeMatch || bitrateMatch) {
        return {
            time: timeMatch?.[1],
            bitrate: bitrateMatch?.[1],
            fps: fpsMatch?.[1],
            frame: frameMatch?.[1],
        };
    }
    return null;
};

// Determine if a log entry is an error
const isErrorLog = (entry: LogEntry): boolean => {
    const msg = (entry.msg || '').toLowerCase();
    const ts = (entry.ts || '').toLowerCase();
    return msg.includes('error') || msg.includes('failed') || ts.includes('error');
};

// Format log timestamp
const formatLogTimestamp = (ts: string): string => {
    // Handle ISO timestamps
    if (ts.includes('T') && ts.includes('Z')) {
        try {
            const date = new Date(ts);
            return date.toLocaleTimeString('en-US', { hour12: false });
        } catch {
            return ts.substring(0, 20);
        }
    }
    // Handle frame= prefixed timestamps (malformed)
    if (ts.startsWith('frame=')) {
        return ts;
    }
    return ts.substring(0, 25);
};

const StreamListRowDetails: React.FC<StreamListRowDetailsProps> = ({
    stream,
    previewUrl,
    hlsResolvedAgo,
    hlsRefreshing,
    hlsError,
    uptimeLabel,
    runtimeHint,
    onCopyHls,
    onRefreshHls,
}) => {
    const [showAllLogs, setShowAllLogs] = React.useState(false);

    // Parse log entries
    const logTail: LogEntry[] = Array.isArray((stream as any).logTail) ? (stream as any).logTail : [];
    const hasLogs = logTail.length > 0;

    // Get latest progress info from logs
    const latestProgress = React.useMemo(() => {
        for (let i = logTail.length - 1; i >= 0; i--) {
            const progress = parseFFmpegProgress(logTail[i].msg);
            if (progress) return progress;
        }
        return null;
    }, [logTail]);

    // Separate errors from normal logs
    const { errors, normalLogs } = React.useMemo(() => {
        const errors: LogEntry[] = [];
        const normalLogs: LogEntry[] = [];
        logTail.forEach(entry => {
            if (isErrorLog(entry)) {
                errors.push(entry);
            } else {
                normalLogs.push(entry);
            }
        });
        return { errors, normalLogs };
    }, [logTail]);
    const providerName = stream.provider?.toUpperCase();
    // Show last 5 logs by default, all when expanded
    const visibleLogs = showAllLogs ? logTail : logTail.slice(-5);

    return (<>
        <style jsx>  {styles}   </style>

        <UiList variant="mini ghost" size="xs" items={[
            { label: 'Provider', children: <><StreamProviderIcon provider={stream.provider || 'custom'} userHandle={stream.userHandle || undefined} providerActive={stream.enabled} /> {providerName}</> },
            {
                label: 'Preview', children: Boolean( previewUrl !== null && stream.enabled && hlsResolvedAgo)? <>
                <UiMedia variant="thumbnail" src={previewUrl as string} alt="stream preview" />{JSON.stringify(previewUrl )}
            </>
             : '<not available>' },
            {
                label: 'HLS URL', children: (
                    <div className="stream-panel__hls d-flex s-w-100 justify-between  g9">

                        {stream.hlsUrl ? (<div className='-stream-list-row-details__'>
                            <div className="stream-panel__hls-value">
                                <UiButton
                                    traits={{
                                        beforeIcon: {
                                            alt: 'Refresh HLS URL',
                                            icon: hlsRefreshing ? 'spinner' : 'fa-rotate',
                                            onClick: onRefreshHls,
                                        },
                                        afterIcon: 'fa-copy',
                                    }}
                                    onClick={onCopyHls}
                                    variant="link"
                                >
                                    {stream.hlsUrl.substring(0, 50)}...

                                </UiButton>
                            </div>
                            {hlsResolvedAgo && <small className="stream-panel__hls-timestamp">({hlsResolvedAgo})</small>}</div>
                        ) : Boolean(stream.enabled && hlsRefreshing)
                            ? <span className="stream-panel__hls-empty"> Resolving... <UiIcon onClick={onRefreshHls} spin icon="fa-rotate" /></span>
                            : <span className="stream-panel__hls-empty">Not resolved <UiIcon onClick={onRefreshHls} icon={hlsRefreshing ? 'spinner' : 'fa-rotate'} /></span>}
                        <div>

                        </div>
                        {/* <UiButton variant="ghost" size="sm" disabled={!stream.enabled || hlsRefreshing} traits={{ beforeIcon: hlsRefreshing ? 'spinner' : 'fa-rotate' }} onClick={onRefreshHls}>{}</UiButton> */}
                        {hlsError && <p className="stream-panel__hls-error">{hlsError}</p>}
                    </div>
                )
            },
            { label: 'User Handle', children: stream.userHandle || '<not set>' },
            { label: 'Stream Key', children: stream.streamKey ? `${stream.streamKey.substring(0, 20)}...` : '<not set>' },
            { label: 'Server URL', children: stream.serverUrl || '<not set>' },
            { label: 'Protocol', children: stream.protocol || '<not set>' },
            { label: 'Selected Device', children: stream.selectedDeviceId || 'auto' },
            { label: 'Runner Host', children: stream.containerHost || 'main-host' },
            { label: 'Device Status', children: stream.deviceStatus || '<unknown>' },
            { label: 'Device Error', children: stream.deviceError || '<none>' },
            { label: 'Uptime', children: uptimeLabel || '<not available>' },
            // Show encoding progress if available
            ...(latestProgress ? [{
                label: 'Encoding',
                children: (
                    <div className="stream-panel__encoding-stats">
                        {latestProgress.time && <span><strong>Time:</strong> {latestProgress.time}</span>}
                        {latestProgress.bitrate && <span><strong>Bitrate:</strong> {latestProgress.bitrate}</span>}
                        {latestProgress.fps && <span><strong>FPS:</strong> {latestProgress.fps}</span>}
                        {latestProgress.frame && <span><strong>Frames:</strong> {latestProgress.frame}</span>}
                    </div>
                )
            }] : []),
            // Show errors prominently if any
            ...(errors.length > 0 ? [{
                label: `Errors (${errors.length})`,
                children: (
                    <div className="stream-panel__log-errors">
                        {errors.slice(-3).map((entry, idx) => (
                            <div key={idx} className="stream-panel__log-entry stream-panel__log-entry--error">
                                <span className="stream-panel__log-msg">{entry.msg.substring(0, 100)}{entry.msg.length > 100 ? '...' : ''}</span>
                            </div>
                        ))}
                    </div>
                )
            }] : []),
            // Collapsible log tail
            ...(hasLogs ? [{
                label: `Logs (${logTail.length})`,
                children: (
                    <div className="stream-panel__logs">
                        <div className="stream-panel__logs-header">
                            <UiButton
                                variant="ghost"
                                size="xs"
                                onClick={() => setShowAllLogs(!showAllLogs)}
                                traits={{ beforeIcon: showAllLogs ? 'fa-chevron-up' : 'fa-chevron-down' }}
                            >
                                {showAllLogs ? 'Show less' : `Show all ${logTail.length} logs`}
                            </UiButton>
                        </div>
                        <div className="stream-panel__logs-list" style={{
                            maxHeight: showAllLogs ? '300px' : '120px',
                            overflowY: 'auto',
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            background: 'var(--gray-90)',
                            padding: '8px',
                            borderRadius: '4px',
                        }}>
                            {visibleLogs.map((entry, idx) => {
                                const isError = isErrorLog(entry);
                                return (
                                    <div
                                        key={idx}
                                        className="stream-panel__log-entry"
                                        style={{
                                            color: isError ? 'var(--red-30)' : 'var(--gray-30)',
                                            marginBottom: '2px',
                                            wordBreak: 'break-all',
                                        }}
                                    >
                                        <span style={{ color: 'var(--gray-50)', marginRight: '8px' }}>
                                            {formatLogTimestamp(entry.ts)}
                                        </span>
                                        <span>{entry.msg}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            }] : []),
            { label: 'Container Name', children: stream.containerName || '<not set>' },
            { label: 'Created At', children: stream.createdAt || '<not set>' },
            { label: 'Updated At', children: stream.updatedAt || '<not set>' },
            { label: 'Runtime Status', children: runtimeHint || (stream as any).runtimeError || 'Normal' },
        ]} />
    </>

    );
};

export default StreamListRowDetails;
