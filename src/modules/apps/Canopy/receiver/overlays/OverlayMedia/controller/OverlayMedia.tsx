// OverlayMedia — generic media-overlay orchestrator (playlist / iframe /
// image / mjpeg / multiview / broll fallback). Share-family overlays
// (screen/camera/encoder/pull) go through <ShareMedia> instead, which has its
// own simpler HLS-only pipeline.

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import styles from './OverlayMedia.scss';
import { useAudioMeter } from '@webstack/hooks/audio/useAudioMeter';

import type { OverlayMediaProps } from '../types';
import useOverlayMediaSrc from '../hooks/useOverlayMediaSrc';
import useOverlayMediaState from '../hooks/useOverlayMediaState';
import usePlaylistTimer from '../hooks/usePlaylistTimer';
import OverlayMediaRenderer from './OverlayMediaRenderer';

// Re-export public types for backward compatibility.
export type { MediaSegmentProps, OverlayMediaProps } from '../types';

const num = (v: any, d: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};

const OverlayMedia: React.FC<OverlayMediaProps> = ({
  overlayId,
  kind = 'video',
  src,
  poster,
  autoplay = true,
  loop = false,
  muted = false,
  controls = false,
  playing = true,
  title,
  description,
  aspectPreset,
  variant = 'default',
  urls,
  segments,
  duration,
  preload,
  volume = 1,
  multiviewColumns = 0,
  multiviewObjectFit = 'contain',
  multiviewShowLabels = false,
}) => {
  const normalizedVariant = variant === 'carousel' ? 'default' : (variant ?? 'default');
  const cls = `overlay-media overlay-media--${normalizedVariant}`;

  // --- Per-segment property resolution ---
  const segArr = useMemo(() => (Array.isArray(segments) && segments.length ? segments : null), [segments]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset playback to the first segment whenever the segment list changes
  // (add / remove / reorder / url edit). Without this, the preview stays
  // stuck on whatever segment was playing until the playlist timer rolls.
  const segSig = useMemo(
    () => (segArr ? segArr.map((s: any) => s?.url ?? '').join('|') : ''),
    [segArr],
  );
  useEffect(() => {
    setCurrentIndex(0);
  }, [segSig]);

  const curSeg = segArr?.[currentIndex % (segArr?.length || 1)] ?? null;

  const vol = Math.max(0, Math.min(1, num(curSeg?.volume ?? volume, 1)));
  const segmentDuration = num(curSeg?.duration ?? duration ?? 30, 30) * 1000;
  const preloadTime = num(curSeg?.preload ?? preload ?? 0, 0) * 1000;

  const segKind = curSeg?.kind ?? kind ?? 'video';
  const segPoster = curSeg?.poster ?? poster ?? '';
  const segAutoplay = typeof curSeg?.autoplay === 'boolean' ? curSeg.autoplay : (autoplay ?? true);
  const segLoop = typeof curSeg?.loop === 'boolean' ? curSeg.loop : (loop ?? false);
  const segMuted = typeof curSeg?.muted === 'boolean' ? curSeg.muted : (muted ?? true);
  const segPlaying = typeof curSeg?.playing === 'boolean' ? curSeg.playing : playing;
  const isPlaying = segPlaying !== false;

  // --- URL + kind resolution ---
  const media = useOverlayMediaSrc({
    kind: segKind, src, urls,
    autoplay: segAutoplay, loop: segLoop, muted: segMuted, currentIndex,
  });

  const skipToNext = useCallback(() => {
    if (media.playlistLen > 1) setCurrentIndex(prev => (prev + 1) % media.playlistLen);
  }, [media.playlistLen]);

  // --- Playback / control state ---
  const state = useOverlayMediaState({
    overlayId, media, autoplay: segAutoplay, loop: segLoop, muted: segMuted, playing: segPlaying, skipToNext,
  });
  const { normalizedKind, refs, loadError, errorLabel, recoveryEpoch, autoplayBlocked, connecting, videoReady, actions } = state;

  // --- Audio meter ---
  const [meterEl, setMeterEl] = useState<HTMLVideoElement | null>(null);
  useEffect(() => { setMeterEl(refs.videoRef?.current ?? null); });
  useAudioMeter({ videoEl: meterEl, overlayId: String(overlayId ?? '') });

  // --- MJPEG cache-busted src ---
  const imgSrc = useMemo(() => {
    if (!media.srcUrl || !media.isLikelyImageStream || recoveryEpoch === 0) return media.srcUrl;
    const sep = media.srcUrl.includes('?') ? '&' : '?';
    return `${media.srcUrl}${sep}_mjpeg_t=${recoveryEpoch}`;
  }, [media.srcUrl, media.isLikelyImageStream, recoveryEpoch]);

  // --- Playlist timer ---
  const { secondsToNext } = usePlaylistTimer({
    hasPlaylist: media.hasPlaylist, playlistLen: media.playlistLen, isPlaying,
    segmentDuration, preloadTime, currentIndex, setCurrentIndex,
    playlist: media.playlist, nextVideoRef: refs.nextVideoRef,
  });

  // --- Volume sync ---
  useEffect(() => {
    if (refs.videoRef?.current) refs.videoRef.current.volume = vol;
  }, [vol, refs.videoRef]);

  const style = useMemo<React.CSSProperties>(() => ({ width: '100%', height: '100%' }), []);

  return (
    <>
      <style jsx>{styles}</style>
      <OverlayMediaRenderer
        cls={cls}
        style={style}
        normalizedKind={normalizedKind}
        loadError={loadError}
        errorLabel={errorLabel}
        imgSrc={imgSrc}
        title={title}
        description={description}
        controls={controls}
        segAutoplay={segAutoplay}
        segLoop={segLoop}
        segMuted={segMuted}
        segPoster={segPoster}
        urls={urls}
        currentIndex={currentIndex}
        secondsToNext={secondsToNext}
        preloadTime={preloadTime}
        normalizedVariant={normalizedVariant}
        segArr={segArr}
        multiviewColumns={multiviewColumns}
        multiviewObjectFit={multiviewObjectFit}
        multiviewShowLabels={multiviewShowLabels}
        media={media}
        refs={refs}
        actions={actions}
        autoplayBlocked={autoplayBlocked}
        connecting={connecting}
        videoReady={videoReady}
      />
    </>
  );
};

export default OverlayMedia;
