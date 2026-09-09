import { IUserStream } from '~/src/core/services/MemberService/IMemberService';

export interface LiveStreamInfo {
    provider: string;
    containerName?: string;
    rtmpUrl?: string;
    lastHeartbeat?: string;
}

const HEARTBEAT_FRESH_MS = 60_000;

const hasRuntimeIssue = (stream: IUserStream): boolean => {
    if (stream.runtimeError) return true;
    const hints = stream.runtimeHints;
    if (!hints) return false;
    if (hints.gpuRequired && hints.gpuAvailable === false) return true;
    return false;
};

const isDbusNoise = (msg?: string): boolean => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes('bus.cc(399')
        || lower.includes('failed to connect to the bus')
        || lower.includes('unknown address type (examples of valid types are "tcp"');
};

const hasErrorLog = (stream: IUserStream): boolean => {
    const last = Array.isArray(stream.logTail) && stream.logTail.length > 0
        ? stream.logTail[stream.logTail.length - 1]
        : undefined;
    const msg: string = (last && (last.msg || last.message || last)) as any;
    if (!msg || typeof msg !== 'string') return false;
    if (isDbusNoise(msg)) return false;
    const lower = msg.toLowerCase();
    return lower.includes('error') || lower.includes('exiting') || lower.includes('failed');
};

const isFresh = (stamp?: string | null) => {
    if (!stamp) return false;
    const parsed = Date.parse(stamp);
    if (Number.isNaN(parsed)) return false;
    return Date.now() - parsed <= HEARTBEAT_FRESH_MS;
};

export const getLiveStreams = (
    userStreams: Record<string, IUserStream>,
): LiveStreamInfo[] => {
    return Object.values(userStreams || {})
        .filter((stream) => Boolean(stream?.enabled) && isFresh(stream.lastHeartbeat))
        .filter((stream) => !hasErrorLog(stream) && !hasRuntimeIssue(stream))
        .map((stream) => ({
            provider: stream.provider,
            containerName: stream.containerName || undefined,
            rtmpUrl: stream.rtmpUrl || undefined,
            lastHeartbeat: stream.lastHeartbeat || undefined,
        }));
};
