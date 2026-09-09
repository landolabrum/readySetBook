import React, { MouseEventHandler } from "react";
import styles from "./UiAudioPlayer.scss";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";

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

interface State {
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

export class UiAudioPlayer extends React.Component<IUiAudioPlayer, State> {
  private audioRef = React.createRef<HTMLAudioElement>();
  private canvasRef = React.createRef<HTMLCanvasElement>();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array = new Uint8Array(0);
  private source: MediaElementAudioSourceNode | null = null;
  private animationId: number | null = null;
  private progressInterval: NodeJS.Timeout | null = null;

  constructor(props: IUiAudioPlayer) {
    super(props);

    const playlist = this.initializePlaylist();

    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: props.volume ?? 0.7,
      isMuted: false,
      isLoading: false,
      error: null,
      currentTrackIndex: 0,
      playlist,
      showPlaylist: props.showPlaylist ?? false,
      visualizerData: new Uint8Array(0),
      backgroundGradient: this.generateGradient([]),
    };
  }

  componentDidMount() {
    this.initializeAudio();
    if (this.props.autoplay) {
      this.play();
    }
  }

  componentWillUnmount() {
    this.cleanup();
  }

  componentDidUpdate(prevProps: IUiAudioPlayer) {
    if (prevProps.src !== this.props.src) {
      this.loadNewSource();
    }
    if (prevProps.volume !== this.props.volume && this.props.volume !== undefined) {
      this.setState({ volume: this.props.volume }, () => {
        if (this.audioRef.current) {
          this.audioRef.current.volume = this.props.volume!;
        }
      });
    }
  }

  private initializePlaylist(): IAudioTrack[] {
    const { src, playlist } = this.props;

    if (playlist && playlist.length > 0) {
      return playlist;
    }

    if (Array.isArray(src)) {
      return src.map((s, i) => ({
        src: s,
        title: `Track ${i + 1}`,
      }));
    }

    if (src) {
      return [{
        src: typeof src === 'string' ? src : '',
        title: 'Audio Track',
      }];
    }

    return [];
  }

  private initializeAudio() {
    const audio = this.audioRef.current;
    if (!audio) return;

    audio.volume = this.state.volume;

    // Initialize Web Audio API
    if (!this.audioContext && this.props.showVisualization !== false) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;

        const bufferLength = this.analyser.frequencyBinCount;
        // Create a standard Uint8Array with ArrayBuffer (not ArrayBufferLike)
        this.dataArray = new Uint8Array(new ArrayBuffer(bufferLength));

        if (!this.source) {
          this.source = this.audioContext.createMediaElementSource(audio);
          this.source.connect(this.analyser);
          this.analyser.connect(this.audioContext.destination);
        }
      } catch (err) {
        console.warn('Web Audio API not supported:', err);
      }
    }

    // Event listeners
    audio.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    audio.addEventListener('timeupdate', this.handleTimeUpdate);
    audio.addEventListener('ended', this.handleEnded);
    audio.addEventListener('error', this.handleError);
    audio.addEventListener('canplay', () => this.setState({ isLoading: false }));
    audio.addEventListener('waiting', () => this.setState({ isLoading: true }));
  }

  private loadNewSource() {
    this.cleanup();
    const playlist = this.initializePlaylist();
    this.setState({
      playlist,
      currentTrackIndex: 0,
      currentTime: 0,
      duration: 0,
    }, () => {
      this.initializeAudio();
    });
  }

  private cleanup() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    const audio = this.audioRef.current;
    if (audio) {
      audio.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
      audio.removeEventListener('timeupdate', this.handleTimeUpdate);
      audio.removeEventListener('ended', this.handleEnded);
      audio.removeEventListener('error', this.handleError);
    }
  }

  private handleLoadedMetadata = () => {
    const audio = this.audioRef.current;
    if (audio) {
      this.setState({
        duration: audio.duration,
        isLoading: false,
      });
    }
  };

  private handleTimeUpdate = () => {
    const audio = this.audioRef.current;
    if (audio) {
      this.setState({ currentTime: audio.currentTime });
      this.props.onTimeUpdate?.(audio.currentTime, audio.duration);
    }
  };

  private handleEnded = () => {
    const { loop } = this.props;
    const { currentTrackIndex, playlist } = this.state;

    if (loop) {
      this.play();
    } else if (currentTrackIndex < playlist.length - 1) {
      this.playTrack(currentTrackIndex + 1);
    } else {
      this.setState({ isPlaying: false });
      this.stopVisualization();
    }

    this.props.onEnded?.();
  };

  private handleError = () => {
    this.setState({
      error: 'Failed to load audio',
      isLoading: false,
      isPlaying: false,
    });
  };

  private play = async () => {
    const audio = this.audioRef.current;
    if (!audio) return;

    try {
      await audio.play();
      this.setState({ isPlaying: true, error: null });
      this.startVisualization();
      this.props.onPlay?.();
    } catch (err: any) {
      console.error('Play error:', err);
      this.setState({
        error: err.message || 'Failed to play audio',
        isPlaying: false,
      });
    }
  };

  private pause = () => {
    const audio = this.audioRef.current;
    if (audio) {
      audio.pause();
      this.setState({ isPlaying: false });
      this.stopVisualization();
      this.props.onPause?.();
    }
  };

  private togglePlay = () => {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  };

  private handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    const audio = this.audioRef.current;

    if (audio) {
      audio.volume = volume;
      this.setState({ volume, isMuted: volume === 0 });
      this.props.onVolumeChange?.(volume);
    }
  };

  private toggleMute = () => {
    const audio = this.audioRef.current;
    if (!audio) return;

    const newMutedState = !this.state.isMuted;
    this.setState({ isMuted: newMutedState });
    audio.muted = newMutedState;
  };

  private handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = this.audioRef.current;
    const time = parseFloat(e.target.value);

    if (audio) {
      audio.currentTime = time;
      this.setState({ currentTime: time });
    }
  };

  private playTrack = (index: number) => {
    if (index < 0 || index >= this.state.playlist.length) return;

    const wasPlaying = this.state.isPlaying;
    this.pause();

    this.setState({
      currentTrackIndex: index,
      currentTime: 0,
    }, () => {
      if (wasPlaying) {
        this.play();
      }
    });
  };

  private skipPrevious = () => {
    const { currentTrackIndex } = this.state;
    if (currentTrackIndex > 0) {
      this.playTrack(currentTrackIndex - 1);
    }
  };

  private skipNext = () => {
    const { currentTrackIndex, playlist } = this.state;
    if (currentTrackIndex < playlist.length - 1) {
      this.playTrack(currentTrackIndex + 1);
    }
  };

  private startVisualization = () => {
    if (!this.analyser || this.dataArray.length === 0 || this.props.showVisualization === false) return;

    const animate = () => {
      if (!this.state.isPlaying) return;

      // @ts-ignore - Web Audio API type mismatch with TypeScript lib.dom.d.ts
      this.analyser!.getByteFrequencyData(this.dataArray);
      this.setState({
        visualizerData: new Uint8Array(this.dataArray),
        backgroundGradient: this.generateGradient(this.dataArray),
      });

      this.drawVisualization();
      this.animationId = requestAnimationFrame(animate);
    };

    animate();
  };

  private stopVisualization = () => {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    const canvas = this.canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  private drawVisualization = () => {
    const canvas = this.canvasRef.current;
    if (!canvas || this.dataArray.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { visualizerType = 'bars' } = this.props;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    switch (visualizerType) {
      case 'bars':
        this.drawBars(ctx, canvas);
        break;
      case 'wave':
        this.drawWave(ctx, canvas);
        break;
      case 'circular':
        this.drawCircular(ctx, canvas);
        break;
      case 'particles':
        this.drawParticles(ctx, canvas);
        break;
      case 'frequency':
        this.drawFrequency(ctx, canvas);
        break;
      default:
        this.drawBars(ctx, canvas);
    }
  };

  private drawBars = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (this.dataArray.length === 0) return;

    const bufferLength = this.dataArray.length;
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;

    const colors = this.getVisualizerColors();

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (this.dataArray[i] / 255) * canvas.height * 0.8;

      const colorIndex = Math.floor((i / bufferLength) * colors.length);
      ctx.fillStyle = colors[colorIndex];

      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  };

  private drawWave = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (this.dataArray.length === 0) return;

    const bufferLength = this.dataArray.length;
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    ctx.lineWidth = 3;
    ctx.strokeStyle = this.getVisualizerColors()[0];
    ctx.beginPath();

    for (let i = 0; i < bufferLength; i++) {
      const v = this.dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  };

  private drawCircular = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (this.dataArray.length === 0) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 3;
    const bufferLength = this.dataArray.length;
    const colors = this.getVisualizerColors();

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (this.dataArray[i] / 255) * radius * 0.7;
      const angle = (Math.PI * 2 * i) / bufferLength;

      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barHeight);
      const y2 = centerY + Math.sin(angle) * (radius + barHeight);

      const colorIndex = Math.floor((i / bufferLength) * colors.length);
      ctx.strokeStyle = colors[colorIndex];
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  };

  private drawParticles = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (this.dataArray.length === 0) return;

    const bufferLength = this.dataArray.length;
    const colors = this.getVisualizerColors();

    for (let i = 0; i < bufferLength; i++) {
      const value = this.dataArray[i];
      const size = (value / 255) * 10;

      const x = (i / bufferLength) * canvas.width;
      const y = canvas.height / 2 + (Math.sin(i * 0.1) * value / 2);

      const colorIndex = Math.floor((i / bufferLength) * colors.length);
      ctx.fillStyle = colors[colorIndex];

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  private drawFrequency = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (this.dataArray.length === 0) return;

    const bufferLength = this.dataArray.length;
    const barWidth = canvas.width / bufferLength;
    const colors = this.getVisualizerColors();

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (this.dataArray[i] / 255) * canvas.height;

      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      const colorIndex = Math.floor((i / bufferLength) * colors.length);
      gradient.addColorStop(0, colors[colorIndex]);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');

      ctx.fillStyle = gradient;
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
    }
  };

  private getVisualizerColors(): string[] {
    const { visualizerColor } = this.props;

    if (Array.isArray(visualizerColor)) {
      return visualizerColor;
    }

    if (visualizerColor) {
      return [visualizerColor];
    }

    // Default gradient colors
    return [
      '#00f5ff',
      '#0099ff',
      '#0066ff',
      '#3333ff',
      '#6600ff',
      '#9900ff',
      '#cc00ff',
      '#ff00cc',
      '#ff0099',
    ];
  };

  private generateGradient = (data: Uint8Array | number[]): string => {
    if (!data || data.length === 0) {
      return 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
    }

    const average = Array.from(data).reduce((a, b) => a + b, 0) / data.length;
    const intensity = average / 255;

    const colors = this.props.backgroundColor
      ? (Array.isArray(this.props.backgroundColor) ? this.props.backgroundColor : [this.props.backgroundColor])
      : ['#1a1a2e', '#16213e', '#0f3460', '#533483'];

    const angle = 135 + (intensity * 45);

    return `linear-gradient(${angle}deg, ${colors.map((c, i) => {
      const position = (i / (colors.length - 1)) * 100;
      const alpha = 0.3 + (intensity * 0.7);
      return `${c}${Math.floor(alpha * 255).toString(16).padStart(2, '0')} ${position}%`;
    }).join(', ')})`;
  };

  private formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  render() {
    const {
      showControls = true,
      className,
      style,
      showVisualization = true,
    } = this.props;

    const {
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      isLoading,
      error,
      currentTrackIndex,
      playlist,
      showPlaylist,
      backgroundGradient,
    } = this.state;

    const currentTrack = playlist[currentTrackIndex];

    return (
      <div
        className={`${styles['ui-audio-player']} ${className || ''}`}
        style={{
          ...style,
          background: showVisualization ? backgroundGradient : undefined,
        }}
      >
        {/* Hidden audio element */}
        <audio
          ref={this.audioRef}
          src={currentTrack?.src}
          preload="metadata"
        />

        {/* Visualization Canvas */}
        {showVisualization && (
          <canvas
            ref={this.canvasRef}
            className={styles['visualizer-canvas']}
          />
        )}

        {/* Track Info */}
        {currentTrack && (
          <div className={styles['track-info']}>
            {currentTrack.artwork && (
              <img
                src={currentTrack.artwork}
                alt={currentTrack.title}
                className={styles['track-artwork']}
              />
            )}
            <div className={styles['track-details']}>
              <div className={styles['track-title']}>{currentTrack.title || 'Unknown Track'}</div>
              {currentTrack.artist && (
                <div className={styles['track-artist']}>{currentTrack.artist}</div>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        {showControls && (
          <div className={styles['controls']}>
            {/* Playback Controls */}
            <div className={styles['playback-controls']}>
              {playlist.length > 1 && (
                <button
                  className={styles['control-button']}
                  onClick={this.skipPrevious}
                  disabled={currentTrackIndex === 0}
                  aria-label="Previous track"
                >
                  <UiIcon icon="skip-back" size={20} />
                </button>
              )}

              <button
                className={`${styles['control-button']} ${styles['play-button']}`}
                onClick={this.togglePlay}
                disabled={isLoading}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoading ? (
                  <UiIcon icon="loader" size={24} spin />
                ) : (
                  <UiIcon icon={isPlaying ? 'pause' : 'play'} size={24} />
                )}
              </button>

              {playlist.length > 1 && (
                <button
                  className={styles['control-button']}
                  onClick={this.skipNext}
                  disabled={currentTrackIndex === playlist.length - 1}
                  aria-label="Next track"
                >
                  <UiIcon icon="skip-forward" size={20} />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            <div className={styles['progress-container']}>
              <span className={styles['time']}>{this.formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={this.handleSeek}
                className={styles['progress-bar']}
                aria-label="Seek"
              />
              <span className={styles['time']}>{this.formatTime(duration)}</span>
            </div>

            {/* Volume Control */}
            <div className={styles['volume-control']}>
              <button
                className={styles['control-button']}
                onClick={this.toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                <UiIcon
                  icon={isMuted ? 'volume-x' : volume > 0.5 ? 'volume-2' : 'volume-1'}
                  size={20}
                />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={this.handleVolumeChange}
                className={styles['volume-slider']}
                aria-label="Volume"
              />
            </div>

            {/* Playlist Toggle */}
            {playlist.length > 1 && (
              <button
                className={styles['control-button']}
                onClick={() => this.setState({ showPlaylist: !showPlaylist })}
                aria-label="Toggle playlist"
              >
                <UiIcon icon="list" size={20} />
              </button>
            )}
          </div>
        )}

        {/* Playlist */}
        {showPlaylist && playlist.length > 1 && (
          <div className={styles['playlist']}>
            <div className={styles['playlist-header']}>Playlist</div>
            <div className={styles['playlist-items']}>
              {playlist.map((track, index) => (
                <div
                  key={index}
                  className={`${styles['playlist-item']} ${
                    index === currentTrackIndex ? styles['active'] : ''
                  }`}
                  onClick={() => this.playTrack(index)}
                >
                  <div className={styles['playlist-item-number']}>{index + 1}</div>
                  <div className={styles['playlist-item-info']}>
                    <div className={styles['playlist-item-title']}>{track.title}</div>
                    {track.artist && (
                      <div className={styles['playlist-item-artist']}>{track.artist}</div>
                    )}
                  </div>
                  {track.duration && (
                    <div className={styles['playlist-item-duration']}>
                      {this.formatTime(track.duration)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={styles['error-message']}>
            <UiIcon icon="alert-circle" size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
}

export default UiAudioPlayer;
