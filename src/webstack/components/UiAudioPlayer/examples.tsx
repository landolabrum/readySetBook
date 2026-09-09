/**
 * UiAudioPlayer - Quick Start Examples
 * 
 * Import the component and use it in your React application
 */

import React from 'react';
import { UiAudioPlayer } from '@webstack/components/UiAudioPlayer';
import type { IAudioTrack } from '@webstack/components/UiAudioPlayer';

// Example 1: Simple Single Track
export const SimplePlayer = () => (
  <UiAudioPlayer
    src="/audio/my-song.mp3"
    visualizerType="bars"
  />
);

// Example 2: Full-Featured Playlist
export const PlaylistPlayer = () => {
  const tracks: IAudioTrack[] = [
    {
      src: '/audio/track1.mp3',
      title: 'Midnight Dreams',
      artist: 'John Doe',
      artwork: '/images/album1.jpg',
    },
    {
      src: '/audio/track2.mp3',
      title: 'Ocean Waves',
      artist: 'Jane Smith',
      artwork: '/images/album2.jpg',
    },
  ];

  return (
    <UiAudioPlayer
      playlist={tracks}
      visualizerType="wave"
      visualizerColor={['#00f5ff', '#667eea', '#764ba2']}
      showPlaylist={true}
      autoplay={false}
      volume={0.7}
    />
  );
};

// Example 3: With Event Handlers
export const InteractivePlayer = () => {
  const handlePlay = () => {
    console.log('Audio started playing');
  };

  const handlePause = () => {
    console.log('Audio paused');
  };

  const handleTimeUpdate = (currentTime: number, duration: number) => {
    const progress = (currentTime / duration) * 100;
    console.log(`Progress: ${progress.toFixed(1)}%`);
  };

  return (
    <UiAudioPlayer
      src="/audio/podcast.mp3"
      visualizerType="circular"
      onPlay={handlePlay}
      onPause={handlePause}
      onTimeUpdate={handleTimeUpdate}
    />
  );
};

// Example 4: Custom Styled
export const CustomStyledPlayer = () => (
  <UiAudioPlayer
    src="/audio/track.mp3"
    visualizerType="frequency"
    visualizerColor={['#4cc9f0', '#4361ee', '#3a0ca3', '#7209b7', '#f72585']}
    backgroundColor={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
    style={{
      maxWidth: '500px',
      margin: '20px auto',
      borderRadius: '16px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    }}
  />
);

// Example 5: Minimal (No Visualization)
export const MinimalPlayer = () => (
  <UiAudioPlayer
    src="/audio/audiobook.mp3"
    showVisualization={false}
    style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100px',
    }}
  />
);

// Example 6: All Visualization Types Demo
export const AllVisualizersDemo = () => {
  const visualizers: Array<'bars' | 'wave' | 'circular' | 'particles' | 'frequency'> = [
    'bars',
    'wave',
    'circular',
    'particles',
    'frequency',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {visualizers.map((type) => (
        <div key={type}>
          <h3>{type.charAt(0).toUpperCase() + type.slice(1)} Visualization</h3>
          <UiAudioPlayer
            src="/audio/sample.mp3"
            visualizerType={type}
            showControls={true}
            showVisualization={true}
          />
        </div>
      ))}
    </div>
  );
};

// Example 7: Multiple Audio Files (Array)
export const MultiFilePlayer = () => (
  <UiAudioPlayer
    src={[
      '/audio/song1.mp3',
      '/audio/song2.mp3',
      '/audio/song3.mp3',
    ]}
    visualizerType="particles"
    showPlaylist={true}
  />
);

// Example 8: Looping Track
export const LoopingPlayer = () => (
  <UiAudioPlayer
    src="/audio/ambient-loop.mp3"
    loop={true}
    autoplay={true}
    visualizerType="wave"
    volume={0.5}
  />
);
