// Relative Path: ./useStreamListRow.ts
import { useMemo } from 'react';
import { StreamStatus } from '../../../../../hooks/useStreamStatus';
import { IUserStream } from '~/src/core/services/MemberService/IMemberService';

/** Extract ffmpeg runtime seconds from log tail entries */
export const extractRuntimeSeconds = (logs?: any[]): number | null => {
    if (!Array.isArray(logs)) return null;
    for (let i = logs.length - 1; i >= 0; i -= 1) {
        const entry = logs[i] as any;
        const msg: string = (entry && (entry.msg || entry.message || entry)) as any;
        if (!msg || typeof msg !== 'string') continue;
        const match = msg.match(/time=(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
        if (!match) continue;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        const seconds = Number(match[3]);
        const frac = match[4] ? Number(`0.${match[4]}`) : 0;
        if ([hours, minutes, seconds].some((n) => !Number.isFinite(n))) continue;
        return Math.max(0, Math.floor(hours * 3600 + minutes * 60 + seconds + frac));
    }
    return null;
};

/** Format seconds into human-readable duration */
export const formatDuration = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
};

/** Parse heartbeat timestamp into epoch ms */
export const parseHeartbeat = (stamp?: string | null): number | null => {
    if (!stamp) return null;
    const trimmed = stamp.replace(/(\.\d{3})\d+/, '$1');
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
    const coarse = Date.parse(stamp.split('.')[0] || stamp);
    return Number.isNaN(coarse) ? null : coarse;
};

/** Format relative time ago */
export const formatTimeAgo = (now: number, timestamp: string | null): string | null => {
    if (!timestamp) return null;
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) return null;
    const diffMs = Math.max(0, now - parsed);
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
};

interface UseStreamListRowLabelsParams {
    stream: IUserStream;
    status?: StreamStatus;
    now: number;
}

export const useStreamListRowLabels = ({ stream, status, now }: UseStreamListRowLabelsParams) => {
    const uptimeLabel = useMemo(() => {
        if (!stream.enabled) return null;
        if (status === 'error') return 'Error — see logs';
        if (status === 'spinning') return 'Spinning up';
        if (status === 'stale') return 'Stale heartbeat';
        if (status === 'running') return 'Up — not yet delivering';
        if (status !== 'live') return 'Not live';
        const runtimeSeconds = extractRuntimeSeconds(stream.logTail);
        if (runtimeSeconds && runtimeSeconds > 0) return `Up: ${formatDuration(runtimeSeconds)}`;
        const stamp = stream.lastHeartbeat;
        if (!stamp) return 'Waiting for heartbeat...';
        const parsed = parseHeartbeat(stamp);
        if (!parsed) return null;
        const diffMs = Math.max(0, now - parsed);
        const totalSeconds = Math.floor(diffMs / 1000);
        return `Up (since last ping): ${formatDuration(totalSeconds)}`;
    }, [now, status, stream.enabled, stream.lastHeartbeat, stream.logTail]);

    const statusLabel = useMemo(() => {
        if (!status || status === 'disabled') return 'Disabled';
        if (status === 'live') return 'Live';
        if (status === 'running') return 'Running';
        if (status === 'error') return 'Error';
        if (status === 'spinning') return 'Spinning up';
        if (status === 'stale') return 'Reconnecting';
        return 'Unknown';
    }, [status]);

    const runtimeHint = useMemo(() => {
        const hints = stream.runtimeHints;
        if (!hints) return null;
        if (hints.gpuRequired && hints.gpuAvailable === false) return hints.gpuMessage || 'GPU unavailable';
        if (hints.gpuRequested && hints.gpuAvailable === false) return hints.gpuMessage || 'GPU not available';
        if (hints.headlessFallbackUsed) return 'Headless fallback active';
        if (hints.gpuMessage) return hints.gpuMessage;
        return null;
    }, [stream.runtimeHints]);

    const hlsResolvedAgo = useMemo(
        () => formatTimeAgo(now, stream.hlsResolvedAt ?? null),
        [now, stream.hlsResolvedAt]
    );

    return { uptimeLabel, statusLabel, runtimeHint, hlsResolvedAgo };
};
