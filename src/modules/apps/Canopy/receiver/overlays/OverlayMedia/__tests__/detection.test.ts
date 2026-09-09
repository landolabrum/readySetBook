import { describe, it, expect } from 'vitest';
import {
  normalizeKind,
  parseYouTubeId,
  isIframeEmbed,
  detectHls,
  detectLikelyImageStream,
  buildH264FallbackUrl,
  buildYouTubeEmbedUrl,
  buildGenericEmbedUrl,
} from '../utils/detection';

describe('normalizeKind', () => {
  it('returns "video" for null/undefined/empty', () => {
    expect(normalizeKind(null)).toBe('video');
    expect(normalizeKind(undefined)).toBe('video');
    expect(normalizeKind('')).toBe('video');
  });
  it('normalizes case', () => {
    expect(normalizeKind('IFrame')).toBe('iframe');
    expect(normalizeKind('IMAGE')).toBe('image');
    expect(normalizeKind('Video')).toBe('video');
  });
  it('returns "video" for unknown kinds', () => {
    expect(normalizeKind('audio')).toBe('video');
  });
});

describe('parseYouTubeId', () => {
  it('parses /watch?v= URLs', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses youtu.be short URLs', () => {
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses /embed/ URLs', () => {
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses /shorts/ URLs', () => {
    expect(parseYouTubeId('https://www.youtube.com/shorts/abc123')).toBe('abc123');
  });
  it('returns null for non-YouTube URLs', () => {
    expect(parseYouTubeId('https://vimeo.com/12345')).toBeNull();
  });
  it('returns null for invalid URLs', () => {
    expect(parseYouTubeId('not-a-url')).toBeNull();
  });
});

describe('isIframeEmbed', () => {
  it('detects YouTube', () => {
    expect(isIframeEmbed('https://www.youtube.com/watch?v=x')).toBe(true);
  });
  it('detects Vimeo', () => {
    expect(isIframeEmbed('https://vimeo.com/12345')).toBe(true);
  });
  it('detects Dailymotion', () => {
    expect(isIframeEmbed('https://www.dailymotion.com/video/x')).toBe(true);
  });
  it('returns false for generic URLs', () => {
    expect(isIframeEmbed('https://example.com/video.mp4')).toBe(false);
  });
});

describe('detectHls', () => {
  it('detects .m3u8 extension', () => {
    expect(detectHls('https://cdn.example.com/stream/index.m3u8')).toBe(true);
  });
  it('detects .m3u8 with query string', () => {
    expect(detectHls('https://cdn.example.com/live.m3u8?token=abc')).toBe(true);
  });
  it('returns false for mp4', () => {
    expect(detectHls('https://cdn.example.com/video.mp4')).toBe(false);
  });
  it('returns false for empty', () => {
    expect(detectHls('')).toBe(false);
  });
});

describe('detectLikelyImageStream', () => {
  it('detects MJPEG paths', () => {
    expect(detectLikelyImageStream('http://cam.local/mjpeg/stream')).toBe(true);
    expect(detectLikelyImageStream('http://cam.local/mjpg/feed')).toBe(true);
  });
  it('detects image extensions', () => {
    expect(detectLikelyImageStream('http://cam.local/snapshot.jpg')).toBe(true);
    expect(detectLikelyImageStream('http://cam.local/frame.png')).toBe(true);
  });
  it('detects RTSP-proxied URLs', () => {
    expect(detectLikelyImageStream('rtsp://cam.local/stream')).toBe(true);
  });
  it('returns false for video URLs', () => {
    expect(detectLikelyImageStream('https://cdn.example.com/video.mp4')).toBe(false);
  });
  it('returns false for empty', () => {
    expect(detectLikelyImageStream('')).toBe(false);
  });
});

describe('buildH264FallbackUrl', () => {
  it('appends -h264 before path extension', () => {
    expect(buildH264FallbackUrl('https://hls.example.com/stream/index.m3u8'))
      .toBe('https://hls.example.com/stream-h264/index.m3u8');
  });
  it('returns null if no path segments to modify', () => {
    expect(buildH264FallbackUrl('https://hls.example.com/')).toBeNull();
  });
});

describe('buildYouTubeEmbedUrl', () => {
  it('constructs embed URL with autoplay', () => {
    const url = buildYouTubeEmbedUrl('abc123', { autoplay: true, muted: true, loop: false });
    expect(url).toContain('https://www.youtube.com/embed/abc123');
    expect(url).toContain('autoplay=1');
    expect(url).toContain('mute=1');
  });
  it('sets mute=0 when not muted', () => {
    const url = buildYouTubeEmbedUrl('abc123', { autoplay: false, muted: false });
    expect(url).toContain('mute=0');
    expect(url).not.toContain('autoplay=1');
  });
});

describe('buildGenericEmbedUrl', () => {
  it('adds autoplay and muted params', () => {
    const url = buildGenericEmbedUrl('https://player.vimeo.com/video/123', { autoplay: true, muted: true, loop: false });
    expect(url).toContain('autoplay=1');
    expect(url).toContain('muted=1');
    expect(url).toContain('loop=0');
  });
  it('preserves existing params', () => {
    const url = buildGenericEmbedUrl('https://example.com/embed?autoplay=0', { autoplay: true });
    // Should not override existing autoplay
    expect(url).toContain('autoplay=0');
  });
  it('returns raw string on invalid URL', () => {
    expect(buildGenericEmbedUrl('not-a-url', { autoplay: true })).toBe('not-a-url');
  });
});
