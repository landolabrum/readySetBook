// UiAudioPlayer Type Definitions
export interface IUiAudioPlayer {
  src?: string | string[];
  autoplay?: boolean;
  loop?: boolean;
  volume?: number;
  visualizerType?: 'bars' | 'wave' | 'circular' | 'particles' | 'frequency';
  visualizerColor?: string | string[];
  backgroundColor?: string | string[];
  showControls?: boolean;
  showPlaylist?: boolean;
  showVisualization?: boolean;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onVolumeChange?: (volume: number) => void;
  playlist?: IAudioTrack[];
  style?: React.CSSProperties;
}

export interface IAudioTrack {
  src: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
}

export interface IUiAudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  currentTrackIndex: number;
  playlist: IAudioTrack[];
  showPlaylist: boolean;
  visualizerData: Uint8Array;
  backgroundGradient: string;
}
