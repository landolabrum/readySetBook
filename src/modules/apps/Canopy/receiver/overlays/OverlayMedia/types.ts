// Shared types for OverlayMedia module.

export type OverlayMediaKind = 'video' | 'iframe' | 'image';

/** Per-segment descriptor — each entry in the timeline carries its own settings. */
export type MediaSegmentProps = {
  url: string;
  kind?: 'video' | 'iframe' | 'image' | string;
  duration?: number;
  preload?: number;
  width?: number;
  height?: number;
  aspectPreset?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playing?: boolean;
  volume?: number;
};

export type OverlayMediaProps = {
  overlayId?: string | number;
  kind?: 'video' | 'iframe' | 'image' | string | null;
  src?: string | null;
  poster?: string | null;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  controls?: boolean;
  playing?: boolean | null;
  title?: string | null;
  description?: string | null;
  variant?: 'default' | 'fullscreen' | string | null;
  aspectPreset?: string | null;
  urls?: string[] | null;
  /** Per-segment timeline data. When provided, per-segment duration/volume/etc take precedence. */
  segments?: MediaSegmentProps[] | null;
  duration?: number | null;
  preload?: number | null;
  width?: number | null;
  height?: number | null;
  volume?: number | null;
  /** Multiview grid settings */
  multiviewColumns?: number;
  multiviewObjectFit?: string;
  multiviewShowLabels?: boolean;
};

/** Resolved source info produced by useOverlayMediaSrc. */
export type OverlayMediaSrcResult = {
  playlist: string[];
  playlistLen: number;
  hasPlaylist: boolean;

  srcUrlRaw: string;
  srcUrl: string;

  ytId: string | null;
  isHls: boolean;
  isLikelyImageStream: boolean;
  shouldForceIframe: boolean;

  requestedKind: OverlayMediaKind;
  /** Cannot be iframe for HLS. */
  effectiveRequestedKind: OverlayMediaKind;
  preferredKind: OverlayMediaKind;
  wantsIframe: boolean;
};

export type YTFunc = 'playVideo' | 'pauseVideo' | 'stopVideo' | 'mute' | 'unMute';
