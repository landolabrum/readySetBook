import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMediaPlayback from '../hooks/useMediaPlayback';

describe('useMediaPlayback', () => {
  let videoEl: HTMLVideoElement;
  let videoRef: { current: HTMLVideoElement | null };

  const makeArgs = (overrides: Record<string, any> = {}) => ({
    normalizedKind: 'video' as const,
    videoRef,
    iframeRef: { current: null } as React.MutableRefObject<HTMLIFrameElement | null>,
    ytId: null as string | null,
    isPlaying: true,
    muted: true,
    ...overrides,
  });

  beforeEach(() => {
    videoEl = document.createElement('video');
    videoEl.play = vi.fn().mockResolvedValue(undefined);
    videoEl.pause = vi.fn();
    videoRef = { current: videoEl };
  });

  it('returns action callbacks', () => {
    const { result } = renderHook(() => useMediaPlayback(makeArgs()));
    expect(result.current.play).toBeTypeOf('function');
    expect(result.current.pause).toBeTypeOf('function');
    expect(result.current.mute).toBeTypeOf('function');
    expect(result.current.unmute).toBeTypeOf('function');
    expect(result.current.restart).toBeTypeOf('function');
  });

  it('play() calls video.play', () => {
    const { result } = renderHook(() => useMediaPlayback(makeArgs()));
    act(() => result.current.play());
    expect(videoEl.play).toHaveBeenCalled();
  });

  it('pause() calls video.pause', () => {
    const { result } = renderHook(() => useMediaPlayback(makeArgs()));
    act(() => result.current.pause());
    expect(videoEl.pause).toHaveBeenCalled();
  });

  it('mute() sets video.muted to true', () => {
    videoEl.muted = false;
    const { result } = renderHook(() => useMediaPlayback(makeArgs({ muted: false })));
    act(() => result.current.mute());
    expect(videoEl.muted).toBe(true);
  });
});
