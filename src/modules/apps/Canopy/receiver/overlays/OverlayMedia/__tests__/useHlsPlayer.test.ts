import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock hls.js before importing the hook
vi.mock('hls.js', () => {
  const listeners: Record<string, Function> = {};
  const hlsInstance = {
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    startLoad: vi.fn(),
    recoverMediaError: vi.fn(),
    on: vi.fn((event: string, cb: Function) => { listeners[event] = cb; }),
    destroy: vi.fn(),
    _listeners: listeners,
  };
  const Hls = vi.fn(function (this: any) { return hlsInstance; });
  (Hls as any).isSupported = vi.fn(() => true);
  (Hls as any).Events = { MANIFEST_PARSED: 'hlsManifestParsed', MANIFEST_LOADED: 'hlsManifestLoaded', ERROR: 'hlsError' };
  (Hls as any).ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
  (Hls as any)._instance = hlsInstance;
  return { default: Hls };
});

import useHlsPlayer from '../hooks/useHlsPlayer';

describe('useHlsPlayer', () => {
  let videoEl: HTMLVideoElement;

  beforeEach(() => {
    videoEl = document.createElement('video');
    videoEl.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('attaches HLS when isHls is true and ref is set', async () => {
    const videoRef = { current: videoEl };
    renderHook(() =>
      useHlsPlayer({
        videoRef,
        srcUrlRaw: 'https://cdn.test/live.m3u8',
        isHls: true,
        normalizedKind: 'video',
        autoplay: true,
        isPlaying: true,
        onFatalError: vi.fn(),
      })
    );
    // Allow dynamic import to resolve
    await new Promise(r => setTimeout(r, 50));
    const Hls = (await import('hls.js')).default;
    expect(Hls).toHaveBeenCalled();
  });

  it('switches to the -h264 variant on a fatal manifestLoadError (HEVC base 500s)', async () => {
    const videoRef = { current: videoEl };
    renderHook(() =>
      useHlsPlayer({
        videoRef,
        srcUrlRaw: 'https://hls.test/abc123/index.m3u8',
        isHls: true,
        normalizedKind: 'video',
        autoplay: true,
        isPlaying: true,
        onFatalError: vi.fn(),
      })
    );
    await new Promise(r => setTimeout(r, 50));
    const Hls = (await import('hls.js')).default;
    const inst = (Hls as any)._instance;

    // Initial load points at the base path.
    expect(inst.loadSource).toHaveBeenLastCalledWith('https://hls.test/abc123/index.m3u8');

    // A dead base manifest must jump straight to the -h264 transcode.
    act(() => {
      inst._listeners['hlsError'](null, { fatal: true, type: 'networkError', details: 'manifestLoadError' });
    });
    expect(inst.loadSource).toHaveBeenLastCalledWith('https://hls.test/abc123-h264/index.m3u8');
  });

  it('does nothing when isHls is false', () => {
    const videoRef = { current: videoEl };
    renderHook(() =>
      useHlsPlayer({
        videoRef,
        srcUrlRaw: 'https://cdn.test/video.mp4',
        isHls: false,
        normalizedKind: 'video',
        autoplay: true,
        isPlaying: true,
        onFatalError: vi.fn(),
      })
    );
  });
});
