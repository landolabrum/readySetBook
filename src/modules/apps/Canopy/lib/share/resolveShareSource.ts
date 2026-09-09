// Single source-of-truth for share-family overlay playback inputs.
//
// Inputs: the overlay row (camera/screen/encoder/pull) + the receiver context
// (live MediaStream and current pipeline session, when this client owns the
// share). Output: one of four playback states, each carrying exactly the data
// the renderer needs to act.

import type { CanonOverlay } from "../../models/overlay/types";

export type ResolveShareCtx = {
    source?: string;
    /**
     * Back-compat: stream of the active/focused session. Used as a fallback
     * when getStreamForSession is not provided or returns null.
     */
    localPipelineStream?: MediaStream | null;
    /** Active/focused session id. Still used for HLS URL matching. */
    pipelineSessionId?: string;
    pipelineHlsUrl?: string;
    /**
     * Per-session stream lookup. Lets multiple concurrent share overlays
     * (camera + screen + …) each resolve to their OWN MediaStream instead of
     * fighting over the singleton.
     */
    getStreamForSession?: (sessionId: string | null | undefined) => MediaStream | null;
};

export type ResolvedShareSource =
    | { kind: 'stream'; stream: MediaStream; sessionId?: string }
    | { kind: 'hls'; src: string; sessionId?: string }
    | { kind: 'waiting'; sessionId?: string }
    | { kind: 'ended' };

const HLS_TEMPLATE = (id: string) => `https://hls.tiktok.soy/${id}/index.m3u8`;
const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const resolveShareSource = (
    overlay: CanonOverlay | any,
    ctx: ResolveShareCtx | undefined,
): ResolvedShareSource => {
    const data = (overlay?.data ?? {}) as any;
    if (data?.sessionEnded === true) return { kind: 'ended' };

    const srcFromData = trim(data?.src);
    // streamKey holds the canonical session id when pipelineSessionId is
    // momentarily blanked across a share restart — try every known field.
    const sessionId =
        trim(data?.pipelineSessionId) ||
        trim(data?.pipeline_session_id) ||
        trim(data?.streamKey) ||
        trim(data?.stream_key) ||
        undefined;

    const ctxSessionId = trim(ctx?.pipelineSessionId) || undefined;
    const ctxHlsUrl = trim(ctx?.pipelineHlsUrl) || undefined;
    const isCurrent = !!sessionId && !!ctxSessionId && sessionId === ctxSessionId;

    // Live MediaStream wins when this client owns a publisher for this
    // overlay's session. Prefer the per-session lookup so multiple share
    // overlays can each resolve to their own track. The singleton stream
    // (legacy in-tree publisher) is only honored when the overlay is
    // explicitly bound to the active session id — never as a fallback for
    // unbound overlays, which would leak the active publisher's stream into
    // a newly-added overlay that hasn't picked up its own binding yet.
    if (ctx?.source !== 'server') {
        const perSession = sessionId ? ctx?.getStreamForSession?.(sessionId) : null;
        if (perSession) {
            return { kind: 'stream', stream: perSession, sessionId };
        }
        if (ctx?.localPipelineStream && isCurrent) {
            return { kind: 'stream', stream: ctx.localPipelineStream, sessionId };
        }
    }

    if (isCurrent && ctxHlsUrl) return { kind: 'hls', src: ctxHlsUrl, sessionId };
    if (srcFromData) return { kind: 'hls', src: srcFromData, sessionId };
    if (sessionId) return { kind: 'hls', src: HLS_TEMPLATE(sessionId), sessionId };

    return { kind: 'waiting', sessionId };
};
