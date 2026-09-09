import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import type { MediaSegmentProps } from '../../types';
import { detectHls } from '../../utils/detection';
import { useAudioMeter } from '@webstack/hooks/audio/useAudioMeter';

type Props = {
  seg: MediaSegmentProps;
  index: number;
  objectFit?: string;
  showLabel?: boolean;
  focused?: boolean;
  hidden?: boolean;
  onClick?: (index: number) => void;
};

const extractLabel = (url: string): string => {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Strip common subdomains
    const host = u.hostname.replace(/^(www|hls|stream|live)\./, '');
    return host;
  } catch {
    // Not a valid URL — return truncated string
    return url.length > 30 ? url.slice(0, 30) + '…' : url;
  }
};

const OverlayMediaMultiviewCell: React.FC<Props> = ({
  seg,
  index,
  objectFit = 'contain',
  showLabel = false,
  focused = false,
  hidden = false,
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const { ref: meterRef } = useAudioMeter({ overlayId: `multiview-${index}` });
  const combinedVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    meterRef(node);
  }, [meterRef]);

  const url = seg.url || '';
  const kind = String(seg.kind || 'video').toLowerCase();
  const isHls = kind === 'video' && detectHls(url);

  /** Inline styles for video/img — must be inline because styled-jsx won't cross component boundaries. */
  const mediaStyle: React.CSSProperties = useMemo(
    () => ({ display: 'block', width: '100%', height: '100%', objectFit: objectFit as any, pointerEvents: 'none' as const }),
    [objectFit],
  );

  /** Cell wrapper inline styles — critical layout props that must not rely on SCSS scoping. */
  const cellStyle: React.CSSProperties = useMemo(() => {
    const base: React.CSSProperties = {
      position: 'relative',
      overflow: 'hidden',
      minHeight: 0,
      minWidth: 0,
      background: '#111',
    };
    if (focused) {
      base.gridColumn = '1 / -1';
      base.gridRow = '1 / -1';
      base.zIndex = 2;
    }
    if (hidden) {
      base.display = 'none';
    }
    return base;
  }, [focused, hidden]);

  const label = useMemo(() => (showLabel ? extractLabel(url) : ''), [showLabel, url]);

  const handleClick = () => onClick?.(index);

  // HLS lifecycle per cell
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !url || !isHls) return;

    let cancelled = false;

    (async () => {
      try {
        const mod = await import('hls.js');
        const Hls = mod.default;
        if (cancelled) return;

        if (!Hls || !Hls.isSupported()) {
          // Fallback to native HLS (Safari)
          el.src = url;
          el.play?.().catch(() => { });
          return;
        }

        if (hlsRef.current) {
          try { hlsRef.current.destroy?.(); } catch { }
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
          backBufferLength: 5,
        });
        hlsRef.current = hls;

        hls.loadSource(url);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) el.play?.().catch(() => { });
        });
      } catch {
        // HLS load failed — try native
        if (!cancelled && el) {
          el.src = url;
          el.play?.().catch(() => { });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        try { hlsRef.current.destroy?.(); } catch { }
        hlsRef.current = null;
      }
    };
  }, [url, isHls]);

  // Non-HLS video — set src directly and play
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !url || isHls || kind !== 'video') return;
    el.src = url;
    if (seg.autoplay !== false) el.play?.().catch(() => { });
  }, [url, isHls, kind, seg.autoplay]);

  const cellClass = [
    'overlay-media-multiview__cell',
    focused ? 'overlay-media-multiview__cell--focused' : '',
    hidden ? 'overlay-media-multiview__cell--hidden' : '',
  ].filter(Boolean).join(' ');

  const labelEl = label ? (
    <span style={{ position: 'absolute', bottom: 4, left: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.6)', color: '#ddd', fontSize: '0.65rem', lineHeight: 1.2, borderRadius: 3, maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{label}</span>
  ) : null;

  if (kind === 'iframe') {
    return (
      <div className={cellClass} style={cellStyle} onClick={handleClick}>
        <iframe
          src={url}
          title={`source-${index}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          frameBorder={0}
          style={{ display: 'block', width: '100%', height: '100%', border: 0, overflow: 'hidden' }}
        />
        {labelEl}
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <div className={cellClass} style={cellStyle} onClick={handleClick}>
        <img src={url} alt={`source-${index}`} draggable={false} style={mediaStyle} />
        {labelEl}
      </div>
    );
  }

  // Default: video (HLS or direct)
  return (
    <div className={cellClass} style={cellStyle} onClick={handleClick}>
      <video
        ref={combinedVideoRef}
        autoPlay={seg.autoplay !== false}
        loop={!!seg.loop}
        muted={seg.muted !== false}
        playsInline
        controls={false}
        poster={seg.poster || undefined}
        style={mediaStyle}
      />
      {labelEl}
    </div>
  );
};

export default OverlayMediaMultiviewCell;
