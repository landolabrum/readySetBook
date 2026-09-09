import { useCallback, useEffect, useRef, useState } from 'react';
import PipelineService, { type SessionStatus } from '~/src/core/services/PipelineService/PipelineService';

export type PullStreamStatus = {
    streamReady: boolean;
    hlsReady: boolean;
    bytesReceived: number;
    activePublishers: number;
    sessionStatus: string;
    loading: boolean;
    error: string | null;
};

const POLL_MS = 10_000;
const MAX_ERRORS = 3;

export function usePullStreamStatus(sessionId: string | undefined): PullStreamStatus {
    const [state, setState] = useState<PullStreamStatus>({
        streamReady: false,
        hlsReady: false,
        bytesReceived: 0,
        activePublishers: 0,
        sessionStatus: 'unknown',
        loading: false,
        error: null,
    });

    const serviceRef = useRef(new PipelineService());
    const errorCountRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inFlightRef = useRef(false);

    const poll = useCallback(async (id: string) => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const s: SessionStatus = await serviceRef.current.getSessionStatus(id);
            errorCountRef.current = 0;
            setState({
                streamReady: s.streamReady,
                hlsReady: s.hlsReady,
                bytesReceived: s.bytesReceived,
                activePublishers: s.activePublishers,
                sessionStatus: s.status,
                loading: false,
                error: null,
            });
        } catch (err: any) {
            errorCountRef.current += 1;
            if (errorCountRef.current >= MAX_ERRORS) {
                setState((prev) => ({ ...prev, loading: false, error: err?.message ?? 'Status unavailable' }));
            }
        } finally {
            inFlightRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (!sessionId) {
            setState({ streamReady: false, hlsReady: false, bytesReceived: 0, activePublishers: 0, sessionStatus: 'unknown', loading: false, error: null });
            return;
        }

        errorCountRef.current = 0;
        setState((prev) => ({ ...prev, loading: true, error: null }));
        poll(sessionId);

        intervalRef.current = setInterval(() => poll(sessionId), POLL_MS);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [sessionId, poll]);

    return state;
}
