import type { MediaSegment } from './types';

/** Default segment values used when a user adds a new entry. */
export const defaultMediaSegment = (url = ''): MediaSegment => ({
  url,
  kind:        'video',
  duration:    30,
  preload:     0,
  width:       1920,
  height:      1080,
  title:       undefined,
  aspectPreset: '16:9',
  poster:      '',
  autoplay:    true,
  loop:        false,
  muted:       false,
  playing:     true,
  volume:      1,
});

/**
 * Normalise legacy `data.urls` (string[]) into the new `data.segments`
 * (MediaSegment[]) shape while preserving backwards-compatible fallback.
 */
export const normalizeSegments = (data: any): MediaSegment[] => {
  if (Array.isArray(data?.segments) && data.segments.length) {
    return data.segments.map((seg: any) => ({
      ...defaultMediaSegment(String(seg?.url ?? '').trim()),
      ...seg,
    }));
  }
  // Legacy: flat string[] urls with shared settings
  const urls: string[] = Array.isArray(data?.urls)
    ? data.urls.map((u: any) => String(u || '').trim()).filter(Boolean)
    : [];
  return urls.map((url) => ({
    ...defaultMediaSegment(url),
    kind:        data?.kind        ?? 'video',
    duration:    typeof data?.duration === 'number'  ? data.duration  : 30,
    preload:     typeof data?.preload  === 'number'  ? data.preload   : 0,
    width:       typeof data?.width    === 'number'  ? data.width     : 1920,
    height:      typeof data?.height   === 'number'  ? data.height    : 1080,
    aspectPreset: data?.aspectPreset   ?? '16:9',
    poster:      data?.poster          ?? '',
    autoplay:    typeof data?.autoplay === 'boolean' ? data.autoplay  : true,
    loop:        typeof data?.loop     === 'boolean' ? data.loop      : false,
    muted:       typeof data?.muted    === 'boolean' ? data.muted     : false,
    playing:     typeof data?.playing  === 'boolean' ? data.playing   : true,
    volume:      typeof data?.volume   === 'number'  ? data.volume    : 1,
  }));
};
