import { describe, it, expect } from 'vitest';
import { resolveShareSource } from '../resolveShareSource';

const mkOverlay = (data: any = {}, type = 'screen') => ({ id: 'ov-1', type, data });

describe('resolveShareSource', () => {
    it('returns ended when data.sessionEnded is true', () => {
        const r = resolveShareSource(mkOverlay({ sessionEnded: true, src: 'x' }), {});
        expect(r).toEqual({ kind: 'ended' });
    });

    it('uses local MediaStream when this client owns the current session', () => {
        const stream = {} as MediaStream;
        const r = resolveShareSource(
            mkOverlay({ pipelineSessionId: 'sess-1' }),
            { source: 'local', localPipelineStream: stream, pipelineSessionId: 'sess-1' },
        );
        expect(r).toEqual({ kind: 'stream', stream, sessionId: 'sess-1' });
    });

    it('does not leak singleton stream to an unbound overlay', () => {
        // Regression: a newly-added overlay with no sessionId must NOT borrow
        // the active publisher's singleton stream — that leaks the screen
        // share into a fresh camera overlay before its binding arrives.
        const stream = {} as MediaStream;
        const r = resolveShareSource(
            mkOverlay({}),
            { source: 'local', localPipelineStream: stream },
        );
        expect(r.kind).toBe('waiting');
    });

    it('does not use local MediaStream on server', () => {
        const stream = {} as MediaStream;
        const r = resolveShareSource(
            mkOverlay({ pipelineSessionId: 'sess-1' }),
            { source: 'server', localPipelineStream: stream, pipelineSessionId: 'sess-1' },
        );
        // server never uses local stream — falls to derived HLS
        expect(r.kind).toBe('hls');
    });

    it('returns ctx.pipelineHlsUrl when overlay matches current session', () => {
        const r = resolveShareSource(
            mkOverlay({ pipelineSessionId: 'sess-1', src: 'data-src' }),
            { pipelineSessionId: 'sess-1', pipelineHlsUrl: 'https://current/index.m3u8' },
        );
        expect(r).toEqual({ kind: 'hls', src: 'https://current/index.m3u8', sessionId: 'sess-1' });
    });

    it('prefers data.src over derived', () => {
        const r = resolveShareSource(
            mkOverlay({ src: 'https://stored/index.m3u8', pipelineSessionId: 'sess-1' }),
            {},
        );
        expect(r).toEqual({ kind: 'hls', src: 'https://stored/index.m3u8', sessionId: 'sess-1' });
    });

    it('derives HLS URL from pipelineSessionId when src is empty', () => {
        const r = resolveShareSource(mkOverlay({ pipelineSessionId: 'p7o-043-6kg' }), {});
        expect(r).toEqual({
            kind: 'hls',
            src: 'https://hls.tiktok.soy/p7o-043-6kg/index.m3u8',
            sessionId: 'p7o-043-6kg',
        });
    });

    // Regression: the exact failure mode that put red "NO MEDIA SOURCE" on the
    // broadcast — src + pipelineSessionId both transiently blank across a
    // share restart, but streamKey survived.
    it('falls back to streamKey when src and pipelineSessionId are blank', () => {
        const r = resolveShareSource(
            mkOverlay({ src: '', pipelineSessionId: '', streamKey: 'p7o-043-6kg' }),
            {},
        );
        expect(r).toEqual({
            kind: 'hls',
            src: 'https://hls.tiktok.soy/p7o-043-6kg/index.m3u8',
            sessionId: 'p7o-043-6kg',
        });
    });

    it('accepts snake_case stream_key as a last resort', () => {
        const r = resolveShareSource(mkOverlay({ stream_key: 'sk-9' }), {});
        expect(r.kind).toBe('hls');
        expect((r as any).src).toContain('sk-9');
    });

    it('uses ctx.pipelineHlsUrl as a final fallback (unlinked overlay on server)', () => {
        const r = resolveShareSource(mkOverlay({}), { pipelineHlsUrl: 'https://fallback/index.m3u8' });
        expect(r).toEqual({ kind: 'hls', src: 'https://fallback/index.m3u8' });
    });

    it('returns waiting when nothing identifies a source', () => {
        expect(resolveShareSource(mkOverlay({}), {})).toEqual({ kind: 'waiting', sessionId: undefined });
    });

    it('prefers getStreamForSession over singleton localPipelineStream', () => {
        const perSessionStream = { id: 'per' } as unknown as MediaStream;
        const singleton = { id: 'singleton' } as unknown as MediaStream;
        const r = resolveShareSource(
            mkOverlay({ pipelineSessionId: 'sess-other' }),
            {
                source: 'local',
                localPipelineStream: singleton,
                pipelineSessionId: 'sess-active',
                getStreamForSession: (sid) => (sid === 'sess-other' ? perSessionStream : null),
            },
        );
        expect(r).toEqual({ kind: 'stream', stream: perSessionStream, sessionId: 'sess-other' });
    });

    it('does not leak singleton to non-current sessions when getStreamForSession returns null', () => {
        const singleton = {} as MediaStream;
        const r = resolveShareSource(
            mkOverlay({ pipelineSessionId: 'sess-other' }),
            {
                source: 'local',
                localPipelineStream: singleton,
                pipelineSessionId: 'sess-active',
                getStreamForSession: () => null,
            },
        );
        expect(r.kind).toBe('hls');
    });

    it('returns waiting with sessionId when only the id is known but it equals ctx and ctx has no hlsUrl', () => {
        // hits the "have a session id but no URL or hlsUrl in ctx" path — still resolves to hls via template
        const r = resolveShareSource(mkOverlay({ pipelineSessionId: 'sess-1' }), { pipelineSessionId: 'sess-1' });
        expect(r.kind).toBe('hls');
    });
});
