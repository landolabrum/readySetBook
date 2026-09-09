import React from 'react';
import type { PullStreamStatus as PullStreamStatusState } from '../hooks/usePullStreamStatus';

type Props = {
    sessionId?: string;
    status: PullStreamStatusState;
    isRemote?: boolean;
};

const fmt = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 4, marginBottom: 8,
    fontSize: 12, fontWeight: 500,
};

const PullStreamStatus: React.FC<Props> = ({ sessionId, status, isRemote }) => {
    if (!sessionId) {
        return (
            <div style={{ ...row, background: '#111', color: '#555' }}>
                <span style={{ fontSize: 10 }}>●</span> No active session
            </div>
        );
    }

    if (status.sessionStatus === 'ended') {
        return (
            <div style={{ ...row, background: '#2e1a1a', color: '#f87171' }}>
                <span style={{ fontSize: 10 }}>●</span> Session ended
            </div>
        );
    }

    if (status.error) {
        return (
            <div style={{ ...row, background: '#2e1a1a', color: '#f87171' }}>
                <span style={{ fontSize: 10 }}>●</span> Status unavailable — {status.error}
            </div>
        );
    }

    if (isRemote && status.hlsReady) {
        return (
            <div style={{ ...row, background: '#0d2e0d', color: '#4ade80' }}>
                <span style={{ color: '#22c55e', fontSize: 10 }}>●</span>
                Remote Live · HLS ready
                {status.bytesReceived > 0 && <span style={{ marginLeft: 'auto', color: '#86efac', fontWeight: 400 }}>{fmt(status.bytesReceived)} rx</span>}
            </div>
        );
    }

    if (status.streamReady && status.hlsReady) {
        return (
            <div style={{ ...row, background: '#0d2e0d', color: '#4ade80' }}>
                <span style={{ color: '#22c55e', fontSize: 10 }}>●</span>
                Live · Source connected · HLS ready
                {status.bytesReceived > 0 && <span style={{ marginLeft: 'auto', color: '#86efac', fontWeight: 400 }}>{fmt(status.bytesReceived)} rx</span>}
            </div>
        );
    }

    if (status.streamReady && !status.hlsReady) {
        return (
            <div style={{ ...row, background: '#2e2a0d', color: '#fbbf24' }}>
                <span style={{ color: '#f59e0b', fontSize: 10 }}>●</span>
                Source connected · Transcoding to HLS…
                {status.bytesReceived > 0 && <span style={{ marginLeft: 'auto', color: '#fde68a', fontWeight: 400 }}>{fmt(status.bytesReceived)} rx</span>}
            </div>
        );
    }

    if (status.sessionStatus === 'active') {
        return (
            <div style={{ ...row, background: '#1a1a2e', color: '#94a3b8' }}>
                <span style={{ color: '#64748b', fontSize: 10 }}>●</span>
                {status.loading ? 'Checking source…' : 'Session active · Waiting for source data…'}
            </div>
        );
    }

    return (
        <div style={{ ...row, background: '#1a1a1a', color: '#64748b' }}>
            <span style={{ fontSize: 10 }}>●</span>
            {status.loading ? 'Connecting…' : 'Waiting for source…'}
        </div>
    );
};

export default PullStreamStatus;
