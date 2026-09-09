import React from 'react';
import { UiAudioPlayer } from '../controller/UiAudioPlayer';
import { IUiAudioPlayer } from '../types';
import styles from './UiAudioPlayerDemo.scss';

/**
 * UiAudioPlayer Demo View
 * 
 * Demonstrates various configurations and features of the UiAudioPlayer component
 */
const UiAudioPlayerDemo: React.FC = () => {
  const sampleTracks = [
    {
      src: '/audio/sample-1.mp3',
      title: 'Midnight Dreams',
      artist: 'Sample Artist',
      album: 'Sample Album',
      artwork: '/images/album-1.jpg',
    },
    {
      src: '/audio/sample-2.mp3',
      title: 'Ocean Waves',
      artist: 'Nature Sounds',
      artwork: '/images/album-2.jpg',
    },
    {
      src: '/audio/sample-3.mp3',
      title: 'City Lights',
      artist: 'Urban Beats',
      artwork: '/images/album-3.jpg',
    },
  ];

  const handlePlay = () => {
    console.log('Audio started playing');
  };

  const handlePause = () => {
    console.log('Audio paused');
  };

  const handleTimeUpdate = (currentTime: number, duration: number) => {
    // console.log(`Progress: ${currentTime}/${duration}`);
  };

  return (
    <div className={styles['demo-container']}>
      <h1>UiAudioPlayer Component Demo</h1>
      
      {/* Single Track with Bars Visualization */}
      <section className={styles['demo-section']}>
        <h2>Single Track - Bars Visualization</h2>
        <UiAudioPlayer
          src="/audio/sample.mp3"
          visualizerType="bars"
          showControls={true}
          showVisualization={true}
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
        />
      </section>

      {/* Playlist with Wave Visualization */}
      <section className={styles['demo-section']}>
        <h2>Playlist - Wave Visualization</h2>
        <UiAudioPlayer
          playlist={sampleTracks}
          visualizerType="wave"
          visualizerColor={['#00f5ff', '#667eea', '#764ba2']}
          showControls={true}
          showVisualization={true}
          showPlaylist={true}
          volume={0.7}
        />
      </section>

      {/* Circular Visualization */}
      <section className={styles['demo-section']}>
        <h2>Circular Visualization</h2>
        <UiAudioPlayer
          src="/audio/sample.mp3"
          visualizerType="circular"
          visualizerColor={['#ff006e', '#fb5607', '#ffbe0b']}
          backgroundColor={['#03071e', '#370617', '#6a040f']}
          showControls={true}
          showVisualization={true}
        />
      </section>

      {/* Particles Visualization */}
      <section className={styles['demo-section']}>
        <h2>Particles Visualization</h2>
        <UiAudioPlayer
          src="/audio/sample.mp3"
          visualizerType="particles"
          visualizerColor={['#06ffa5', '#00d9ff', '#b15eff']}
          showControls={true}
          showVisualization={true}
        />
      </section>

      {/* Frequency Visualization */}
      <section className={styles['demo-section']}>
        <h2>Frequency Visualization</h2>
        <UiAudioPlayer
          src="/audio/sample.mp3"
          visualizerType="frequency"
          visualizerColor={['#4cc9f0', '#4361ee', '#3a0ca3', '#7209b7', '#f72585']}
          showControls={true}
          showVisualization={true}
          autoplay={false}
          loop={true}
        />
      </section>

      {/* Minimal Player - No Visualization */}
      <section className={styles['demo-section']}>
        <h2>Minimal Player (No Visualization)</h2>
        <UiAudioPlayer
          src="/audio/sample.mp3"
          showControls={true}
          showVisualization={false}
          className={styles['minimal-player']}
        />
      </section>

      {/* Custom Styled Player */}
      <section className={styles['demo-section']}>
        <h2>Custom Styled Player</h2>
        <UiAudioPlayer
          src="/audio/sample.mp3"
          visualizerType="bars"
          visualizerColor="#ff3366"
          backgroundColor={['#1a1a2e', '#16213e']}
          showControls={true}
          showVisualization={true}
          style={{
            maxWidth: '500px',
            margin: '0 auto',
          }}
        />
      </section>
    </div>
  );
};

export default UiAudioPlayerDemo;
