import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './PipelineLogs.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import type { PipelineLogEntry } from '~/src/core/services/PipelineService/PipelineService';
import PipelineService from '~/src/core/services/PipelineService/PipelineService';

type Props = {
    sessionId?: string;
    pollIntervalMs?: number;
    maxLines?: number;
};

const isNoiseLog = (msg: string): boolean => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return (
        lower.includes('bus.cc(399') ||
        lower.includes('failed to connect to the bus') ||
        lower.includes('deb [api]') ||
        lower.includes('deb [webrtc]') ||
        lower.includes('deb [hls]') ||
        (lower.includes('get /') && lower.includes('http/'))
    );
};

export const PipelineLogs: React.FC<Props> = ({
    sessionId,
    pollIntervalMs = 15_000,
    maxLines = 10,
}) => {
    const [logs, setLogs] = useState<PipelineLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showNoise, setShowNoise] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const serviceRef = useRef(new PipelineService());
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const fetchInFlightRef = useRef(false);

    const fetchLogs = useCallback(async () => {
        if (!sessionId || fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        try {
            setLoading(true);
            const fetched = await serviceRef.current.getSessionLogs(sessionId, expanded ? 100 : 50);
            setLogs(fetched);
            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Failed to fetch logs');
        } finally {
            setLoading(false);
            fetchInFlightRef.current = false;
        }
    }, [sessionId, expanded]);

    // Initial fetch and polling
    useEffect(() => {
        if (!sessionId) {
            setLogs([]);
            return;
        }

        fetchLogs();

        intervalRef.current = setInterval(fetchLogs, pollIntervalMs);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [sessionId, pollIntervalMs, fetchLogs]);

    if (!sessionId) return null;

    const filteredLogs = showNoise ? logs : logs.filter((entry) => !isNoiseLog(entry.msg));
    const displayLogs = expanded ? filteredLogs : filteredLogs.slice(0, maxLines);
    const suppressedCount = logs.length - filteredLogs.length;

    const getLevelClass = (level?: string) => {
        switch (level) {
            case 'error':
                return 'pipeline-logs__level--error';
            case 'warn':
                return 'pipeline-logs__level--warn';
            case 'debug':
                return 'pipeline-logs__level--debug';
            default:
                return 'pipeline-logs__level--info';
        }
    };

    return (
        <>
            <style jsx>{styles}</style>
            <div className={`pipeline-logs ${expanded ? 'pipeline-logs--expanded' : ''}`}>
                <div className="pipeline-logs__header">
                    <span className="pipeline-logs__title">
                        <UiIcon icon="fa-terminal" />
                        Logs ({filteredLogs.length})
                    </span>
                    <div className="pipeline-logs__actions">
                        {suppressedCount > 0 && (
                            <button
                                type="button"
                                className="pipeline-logs__toggle"
                                onClick={() => setShowNoise((v) => !v)}
                            >
                                {showNoise ? 'Hide noise' : `+${suppressedCount} hidden`}
                            </button>
                        )}
                        <button
                            type="button"
                            className="pipeline-logs__toggle"
                            onClick={() => setExpanded((v) => !v)}
                        >
                            {expanded ? 'Collapse' : 'Expand'}
                        </button>
                        <button
                            type="button"
                            className="pipeline-logs__refresh"
                            onClick={fetchLogs}
                            disabled={loading}
                        >
                            <UiIcon icon={loading ? 'spinner' : 'fa-rotate'} />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="pipeline-logs__error">
                        <UiIcon icon="fa-triangle-exclamation" /> {error}
                    </div>
                )}

                <div className="pipeline-logs__content">
                    {displayLogs.length === 0 ? (
                        <div className="pipeline-logs__empty">
                            {loading ? 'Loading logs...' : 'No logs available for this session'}
                        </div>
                    ) : (
                        displayLogs.map((entry, idx) => (
                            <div key={`log-${idx}`} className={`pipeline-logs__row ${getLevelClass(entry.level)}`}>
                                <span className="pipeline-logs__ts">{entry.ts}</span>
                                <span className="pipeline-logs__msg">{entry.msg}</span>
                            </div>
                        ))
                    )}
                </div>

                {!expanded && filteredLogs.length > maxLines && (
                    <div className="pipeline-logs__more">
                        <button type="button" onClick={() => setExpanded(true)}>
                            Show {filteredLogs.length - maxLines} more logs...
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default PipelineLogs;
