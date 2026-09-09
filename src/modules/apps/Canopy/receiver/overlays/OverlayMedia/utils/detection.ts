// URL detection and classification utilities for OverlayMedia.

import type { OverlayMediaKind } from '../types';

/** Normalise a raw kind string to a known OverlayMediaKind. */
export const normalizeKind = (kind: any): OverlayMediaKind => {
  const n = String(kind || 'video').toLowerCase();
  if (n === 'iframe') return 'iframe';
  if (n === 'image') return 'image';
  return 'video';
};

/** Extract a YouTube video ID from common URL formats. */
export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/watch')) return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' && parts[1]) return parts[1];
      if (parts[0] === 'shorts' && parts[1]) return parts[1];
    }
  } catch {}
  return null;
}

/** Return true when the URL matches a known iframe-only embed provider. */
export function isIframeEmbed(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host.endsWith('brownrice.com') && u.pathname.includes('/embed/')) return true;
    if (host.endsWith('youtube.com')) return true;
    if (host === 'youtu.be') return true;
    if (host.endsWith('vimeo.com')) return true;
    if (host.endsWith('dailymotion.com')) return true;
  } catch {}
  return false;
}

/** Return true when the URL points to an HLS manifest. */
export const detectHls = (url: string): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8')) return true;
  if (lower.includes('application/vnd.apple.mpegurl')) return true;
  if (lower.includes('application/x-mpegurl')) return true;
  return false;
};

/** Return true when the URL is likely an MJPEG or image-based stream. */
export const detectLikelyImageStream = (url: string): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();

  if (/\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/.test(lower)) return true;
  if (lower.includes('mjpg') || lower.includes('mjpeg')) return true;
  if (lower.includes('snapshot') || lower.includes('frame.jpg') || lower.includes('still.jpg')) return true;
  if (lower.includes('rtsp://')) return true;
  if (lower.includes('rtsp=') || lower.includes('/rtsp') || lower.includes('rtsp?') || lower.includes('rtsp%3a'))
    return true;
  if (lower.includes('stream=jpeg') || lower.includes('stream=jpg')) return true;

  return false;
};

/**
 * Build a fallback HLS URL for the H.264-transcoded variant.
 * Returns `null` when a fallback can't be derived (e.g. already `-h264`).
 */
export const buildH264FallbackUrl = (url: string): string | null => {
  if (!url) return null;
  if (url.includes('-h264/')) return null;
  const m = url.match(/^(.*\/)([^/]+)(\/index\.m3u8.*)$/i);
  if (m) return `${m[1]}${m[2]}-h264${m[3]}`;
  const m2 = url.match(/^(.*\/)([^/]+)(\.m3u8.*)$/i);
  if (m2) return `${m2[1]}${m2[2]}-h264${m2[3]}`;
  return null;
};

/** Build a YouTube embed URL with common overlay params. */
export const buildYouTubeEmbedUrl = (
  id: string,
  opts: { autoplay?: boolean; muted?: boolean; loop?: boolean },
): string => {
  const params = new URLSearchParams();
  if (opts.autoplay) params.set('autoplay', '1');
  params.set('controls', '0');
  params.set('rel', '0');
  params.set('modestbranding', '1');
  params.set('playsinline', '1');
  params.set('mute', opts.muted ? '1' : '0');
  params.set('enablejsapi', '1');
  try {
    params.set('origin', window.location.origin);
  } catch {}
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
};

/** Append autoplay/mute/controls query params to a generic embed URL. */
export const buildGenericEmbedUrl = (
  raw: string,
  opts: { autoplay?: boolean; muted?: boolean; loop?: boolean },
): string => {
  try {
    const u = new URL(raw);
    if (opts.autoplay && !u.searchParams.has('autoplay')) u.searchParams.set('autoplay', '1');
    if (!u.searchParams.has('muted')) u.searchParams.set('muted', '1');
    if (!u.searchParams.has('controls')) u.searchParams.set('controls', '0');
    if (!u.searchParams.has('loop')) u.searchParams.set('loop', opts.loop ? '1' : '0');
    return u.toString();
  } catch {
    return raw;
  }
};
