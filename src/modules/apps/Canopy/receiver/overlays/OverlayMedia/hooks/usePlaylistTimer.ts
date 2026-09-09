// Playlist auto-progression timer with preload support.

import { useEffect, useRef, useState } from 'react';

export type UsePlaylistTimerArgs = {
  hasPlaylist: boolean;
  playlistLen: number;
  isPlaying: boolean;
  segmentDuration: number; // ms
  preloadTime: number;     // ms
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  playlist: string[];
  nextVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
};

export type UsePlaylistTimerResult = {
  secondsToNext: number;
};

/**
 * Drives segment auto-progression for playlist overlays.
 * Preloads the next segment's video when `preloadTime > 0`.
 * Exposes a countdown (seconds until next segment) for the label.
 */
export default function usePlaylistTimer({
  hasPlaylist,
  playlistLen,
  isPlaying,
  segmentDuration,
  preloadTime,
  currentIndex,
  setCurrentIndex,
  playlist,
  nextVideoRef,
}: UsePlaylistTimerArgs): UsePlaylistTimerResult {
  const [timeUntilNextMs, setTimeUntilNextMs] = useState<number | null>(null);
  const playlistRef = useRef<string[]>(playlist);
  playlistRef.current = playlist;

  // Segment switch + preload timer
  useEffect(() => {
    if (!hasPlaylist || !isPlaying || playlistLen <= 1) return;

    let preloadTimer: NodeJS.Timeout | null = null;
    if (preloadTime > 0 && preloadTime < segmentDuration) {
      preloadTimer = setTimeout(() => {
        const nextIdx = (currentIndex + 1) % playlistLen;
        const nextUrl = playlistRef.current[nextIdx];
        if (nextUrl && nextVideoRef.current) {
          nextVideoRef.current.src = nextUrl;
          nextVideoRef.current.load();
        }
      }, segmentDuration - preloadTime);
    }

    const switchTimer = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % playlistLen);
    }, segmentDuration);

    return () => {
      if (preloadTimer) clearTimeout(preloadTimer);
      clearTimeout(switchTimer);
    };
  }, [hasPlaylist, isPlaying, playlistLen, segmentDuration, preloadTime, currentIndex, setCurrentIndex, nextVideoRef]);

  // Countdown UI
  useEffect(() => {
    if (!hasPlaylist || playlistLen <= 1 || !isPlaying) {
      setTimeUntilNextMs(null);
      return;
    }
    setTimeUntilNextMs(segmentDuration);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setTimeUntilNextMs(Math.max(segmentDuration - (Date.now() - startedAt), 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [hasPlaylist, playlistLen, isPlaying, segmentDuration, currentIndex]);

  return {
    secondsToNext: timeUntilNextMs !== null ? Math.max(0, Math.ceil(timeUntilNextMs / 1000)) : 0,
  };
}
