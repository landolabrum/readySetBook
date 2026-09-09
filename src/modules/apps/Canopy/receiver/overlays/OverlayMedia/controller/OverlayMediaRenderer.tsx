// OverlayMediaRenderer — all render branches extracted from the controller.

import React, { useEffect, useState } from 'react';
import styles from './OverlayMedia.scss';
import UiMedia from '@webstack/components/UiMedia/controller/UiMedia';
import OverlayMediaLabel from '../views/OverlayMediaLabel/OverlayMediaLabel';
import OverlayMediaMultiview from '../views/OverlayMediaMultiview/OverlayMediaMultiview';
import { FALLBACK_BROLL_URL } from '../constants';
import type { OverlayMediaKind, MediaSegmentProps } from '../types';

const HLS_PROXY_PATH = '/stream/hls.m3u8';
type HlsStatus = { ready: boolean; source: string; reason?: string; path?: string | null };

function extractCamIdFromProxyUrl(srcUrl?: string): string | null {
  if (!srcUrl) return null;
  if (!srcUrl.includes(HLS_PROXY_PATH)) return null;
  try {
    const u = new URL(srcUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (!u.pathname.endsWith(HLS_PROXY_PATH)) return null;
    return u.searchParams.get('id');
  } catch {
    return null;
  }
}

function buildStatusEndpoint(srcUrl: string, camId: string): string {
  // Co-located with the .m3u8 proxy: replace the final segment.
  try {
    const u = new URL(srcUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    u.pathname = u.pathname.replace(/hls\.m3u8$/, 'hls.status');
    u.searchParams.set('id', camId);
    return u.toString();
  } catch {
    return `/stream/hls.status?id=${encodeURIComponent(camId)}`;
  }
}

type Props = {
  cls: string;
  style: React.CSSProperties;
  // state
  normalizedKind: OverlayMediaKind;
  loadError: boolean;
  errorLabel: string;
  imgSrc: string;
  // overlay data
  title?: string | null;
  description?: string | null;
  controls: boolean;
  // segment props
  segAutoplay: boolean;
  segLoop: boolean;
  segMuted: boolean;
  segPoster: string;
  // playlist
  urls?: string[] | null;
  currentIndex: number;
  secondsToNext: number;
  preloadTime: number;
  // multiview
  normalizedVariant: string;
  segArr: MediaSegmentProps[] | null;
  multiviewColumns: number;
  multiviewObjectFit: string;
  multiviewShowLabels: boolean;
  // resolved media
  media: { srcUrl: string; isHls: boolean; hasPlaylist: boolean; playlistLen: number };
  // refs + actions
  refs: {
    iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
    videoRef: React.MutableRefObject<HTMLVideoElement | null>;
    nextVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  };
  actions: {
    onIframeLoad: () => void;
    onVideoError: () => void;
    onImageError: () => void;
    onImageLoad: () => void;
    clearError: () => void;
    enableSound?: () => void;
  };
  // Visual-status inputs from useOverlayMediaState — render a badge in the
  // tile so the producer knows whether we're connecting, blocked by
  // autoplay policy, or staring at a dead camera.
  autoplayBlocked?: boolean;
  connecting?: boolean;
  videoReady?: boolean;
};

/**
 * Tiny presentational badge layer rendered above the `<video>` whenever
 * we're not in steady-play. Click handler is only attached for the
 * autoplay-blocked CTA — every other state is informational.
 */
const TileStatusBadge: React.FC<{
  kind: 'connecting' | 'autoplay-blocked' | 'camera-offline' | 'stream-error';
  label: string;
  detail?: string | null;
  onClick?: () => void;
}> = ({ kind, label, detail, onClick }) => {
  const interactive = !!onClick;
  return (
    <div
      className={`overlay-media__tile-status overlay-media__tile-status--${kind} ${interactive ? 'is-interactive' : ''}`}
      role={interactive ? 'button' : 'status'}
      aria-live="polite"
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick!(); } : undefined}
      tabIndex={interactive ? 0 : -1}
    >
      <span className="overlay-media__tile-status-dot" aria-hidden />
      <span className="overlay-media__tile-status-label">{label}</span>
      {detail ? <span className="overlay-media__tile-status-detail">{detail}</span> : null}
    </div>
  );
};

/**
 * Hook: when the playing src points at our `/stream/hls.m3u8?id=…` proxy
 * AND we're seeing a load error, fetch `/stream/hls.status?id=…` so we
 * can distinguish "Camera offline" from "Stream error — retrying".
 *
 * Skipped entirely for non-proxy sources (kilolink/pipeline HLS,
 * external URLs) so this never makes spurious requests against
 * unrelated hosts.
 */
function useHlsProxyStatus(srcUrl: string | undefined, loadError: boolean): HlsStatus | null {
  const [status, setStatus] = useState<HlsStatus | null>(null);
  useEffect(() => {
    setStatus(null);
    const camId = extractCamIdFromProxyUrl(srcUrl);
    if (!camId || !loadError) return;
    const endpoint = buildStatusEndpoint(srcUrl as string, camId);
    let cancelled = false;
    fetch(endpoint, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setStatus(data as HlsStatus); })
      .catch(() => { /* status endpoint is best-effort */ });
    return () => { cancelled = true; };
  }, [srcUrl, loadError]);
  return status;
}

const OverlayMediaRenderer: React.FC<Props> = (p) => {
  const proxyStatus = useHlsProxyStatus(p.media.srcUrl, !!p.loadError);
  // Multiview
  if (p.normalizedVariant === 'multiview' && p.segArr && p.segArr.length > 1) {
    return (
      <OverlayMediaMultiview
        segments={p.segArr}
        title={p.title}
        description={p.description}
        style={p.style}
        columns={p.multiviewColumns}
        objectFit={p.multiviewObjectFit}
        showLabels={p.multiviewShowLabels}
      />
    );
  }

  // No source at all — fallback broll
  if (!p.media.srcUrl) {
    return (
      <div className={p.cls} style={p.style}>
        <style jsx>{styles}</style>
        <UiMedia loadingText="test" loop autoplay muted type="video" src={FALLBACK_BROLL_URL} />
        <div className="overlay-media__empty overlay-media__no-source">no media source</div>
      </div>
    );
  }

  // Resolve which (if any) status badge to show this render. Only one badge
  // at a time — we pick the most actionable / specific signal.
  const camId = extractCamIdFromProxyUrl(p.media.srcUrl);
  let badge: { kind: 'connecting' | 'autoplay-blocked' | 'camera-offline' | 'stream-error'; label: string; detail?: string | null; onClick?: () => void } | null = null;
  if (p.autoplayBlocked) {
    badge = { kind: 'autoplay-blocked', label: 'Tap for sound', onClick: p.actions.enableSound };
  } else if (p.loadError) {
    // For our own proxy, query `/stream/hls.status` so we can show a
    // precise "Camera offline" instead of a generic retry message.
    if (camId && proxyStatus && proxyStatus.ready === false) {
      badge = { kind: 'camera-offline', label: 'Camera offline', detail: camId };
    } else {
      badge = { kind: 'stream-error', label: 'Stream error — retrying', detail: p.errorLabel || null, onClick: p.actions.clearError };
    }
  } else if (p.connecting && !p.videoReady) {
    badge = { kind: 'connecting', label: 'Connecting…' };
  }

  // Normal playback
  return (
    <div className={p.cls} style={p.style} role="region" aria-label={p.title || 'media'}>
      <style jsx>{styles}</style>
      {p.loadError && (
        <div className="overlay-media__status error" aria-live="polite">
          Media failed to load{p.errorLabel ? `: ${p.errorLabel}` : ''}
          {p.media.hasPlaylist && p.media.playlistLen > 1 ? ' - skipping' : ''}
        </div>
      )}
      {badge && (
        <TileStatusBadge
          kind={badge.kind}
          label={badge.label}
          detail={badge.detail}
          onClick={badge.onClick}
        />
      )}

      <OverlayMediaLabel
        title={p.title}
        description={p.description}
        srcUrl={p.media.srcUrl}
        urls={p.urls}
        currentIndex={p.currentIndex}
        secondsToNext={p.secondsToNext}
        hasPlaylist={p.media.hasPlaylist}
        isStream={false}
      />

      {p.normalizedKind === 'iframe' ? (
        <iframe
          className="overlay-media__frame"
          src={p.media.srcUrl}
          width="100%"
          height="100%"
          scrolling="no"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          frameBorder={0}
          style={{ border: '0', overflow: 'hidden', background: 'transparent' }}
          title={p.title || p.description || 'media'}
          ref={p.refs.iframeRef}
          onLoad={p.actions.onIframeLoad}
        />
      ) : p.normalizedKind === 'image' ? (
        <img
          className="overlay-media__image"
          src={p.imgSrc}
          alt={p.title || p.description || 'media'}
          onError={p.actions.onImageError}
          onLoad={p.actions.onImageLoad}
          draggable={false}
          style={{ background: 'transparent' }}
        />
      ) : (
        <>
          <video
            className="overlay-media__video"
            src={p.media.isHls ? undefined : p.media.srcUrl}
            autoPlay={!!p.segAutoplay}
            loop={!!p.segLoop}
            muted={!!p.segMuted}
            controls={false}
            playsInline
            poster={p.segPoster || undefined}
            ref={p.refs.videoRef}
            onError={p.actions.onVideoError}
            onCanPlay={p.actions.clearError}
            style={{ background: 'transparent' }}
          />
          {p.media.hasPlaylist && p.media.playlistLen > 1 && p.preloadTime > 0 && (
            <video ref={p.refs.nextVideoRef} style={{ display: 'none' }} preload="auto" muted />
          )}
        </>
      )}
    </div>
  );
};

export default OverlayMediaRenderer;
