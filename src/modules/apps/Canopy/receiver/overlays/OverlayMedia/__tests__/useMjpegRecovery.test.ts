import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMjpegRecovery from '../hooks/useMjpegRecovery';

const makeArgs = (overrides: Partial<Parameters<typeof useMjpegRecovery>[0]> = {}) => ({
  srcUrlRaw: 'http://cam.local/mjpeg',
  isLikelyImageStream: true,
  normalizedKind: 'image' as const,
  loadError: false,
  clearError: vi.fn(),
  setImageFallbackEnabled: vi.fn(),
  setKindOverride: vi.fn(),
  ...overrides,
});

describe('useMjpegRecovery', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns initial epoch of 0', () => {
    const { result } = renderHook(() => useMjpegRecovery(makeArgs()));
    expect(result.current.recoveryEpoch).toBe(0);
  });

  it('increments epoch after error recovery delay', () => {
    const clearError = vi.fn();
    const { result } = renderHook(() =>
      useMjpegRecovery(makeArgs({ loadError: true, clearError }))
    );
    expect(result.current.recoveryEpoch).toBe(0);

    act(() => { vi.advanceTimersByTime(21000); }); // base interval is 20s
    expect(result.current.recoveryEpoch).toBe(1);
    expect(clearError).toHaveBeenCalled();
  });

  it('resets when srcUrlRaw changes', () => {
    const { result, rerender } = renderHook(
      ({ srcUrlRaw }) => useMjpegRecovery(makeArgs({ srcUrlRaw, loadError: true })),
      { initialProps: { srcUrlRaw: 'http://cam.local/mjpeg' } }
    );

    act(() => { vi.advanceTimersByTime(21000); });
    expect(result.current.recoveryEpoch).toBeGreaterThan(0);

    rerender({ srcUrlRaw: 'http://cam.local/mjpeg2' });
    expect(result.current.recoveryEpoch).toBe(0);
  });
});
