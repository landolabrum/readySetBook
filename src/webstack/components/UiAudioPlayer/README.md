# UiAudioPlayer Component

A powerful, feature-rich audio player component with real-time audio visualization for React applications. Built with Web Audio API and inspired by modern music visualizers.

## Features

- 🎵 **Multiple Audio Sources**: Support for single tracks, arrays, or custom playlists
- 🌊 **5 Visualization Types**: Bars, Wave, Circular, Particles, and Frequency
- 🎨 **Customizable Colors**: Full control over visualizer and background colors with animated gradients
- 📱 **Responsive Design**: Works beautifully on desktop, tablet, and mobile
- 🎛️ **Full Controls**: Play/pause, seek, volume, skip tracks, and playlist management
- ⚡ **High Performance**: Optimized canvas rendering with requestAnimationFrame
- 🎭 **Class Component**: Built as a React class component following your webapp patterns
- 🔊 **Web Audio API**: Real-time frequency analysis for visualizations

## Installation

The component is located in `webapp/src/webstack/components/UiAudioPlayer/`

```tsx
import { UiAudioPlayer } from '@webstack/components/UiAudioPlayer';
// or
import UiAudioPlayer from '@webstack/components/UiAudioPlayer';
```

## Basic Usage

### Single Audio File

```tsx
<UiAudioPlayer
  src="/audio/song.mp3"
  visualizerType="bars"
  showControls={true}
  showVisualization={true}
/>
```

### Playlist

```tsx
const playlist = [
  {
    src: '/audio/track1.mp3',
    title: 'Song Title 1',
    artist: 'Artist Name',
    artwork: '/images/cover1.jpg',
  },
  {
    src: '/audio/track2.mp3',
    title: 'Song Title 2',
    artist: 'Artist Name',
  },
];

<UiAudioPlayer
  playlist={playlist}
  visualizerType="wave"
  showPlaylist={true}
  autoplay={false}
/>
```

## Props API

### IUiAudioPlayer Interface

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string \| string[]` | - | Audio file URL(s) |
| `playlist` | `IAudioTrack[]` | - | Array of track objects with metadata |
| `autoplay` | `boolean` | `false` | Auto-start playback on mount |
| `loop` | `boolean` | `false` | Loop the current track |
| `volume` | `number` | `0.7` | Initial volume (0-1) |
| `visualizerType` | `'bars' \| 'wave' \| 'circular' \| 'particles' \| 'frequency'` | `'bars'` | Visualization style |
| `visualizerColor` | `string \| string[]` | Default gradient | Color(s) for the visualizer |
| `backgroundColor` | `string \| string[]` | Default gradient | Background color(s) |
| `showControls` | `boolean` | `true` | Show player controls |
| `showPlaylist` | `boolean` | `false` | Show playlist view |
| `showVisualization` | `boolean` | `true` | Enable audio visualization |
| `className` | `string` | - | Additional CSS class |
| `style` | `React.CSSProperties` | - | Inline styles |
| `onPlay` | `() => void` | - | Callback when playback starts |
| `onPause` | `() => void` | - | Callback when paused |
| `onEnded` | `() => void` | - | Callback when track ends |
| `onTimeUpdate` | `(currentTime, duration) => void` | - | Callback on time update |
| `onVolumeChange` | `(volume) => void` | - | Callback on volume change |

### IAudioTrack Interface

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `src` | `string` | ✅ | Audio file URL |
| `title` | `string` | ❌ | Track title |
| `artist` | `string` | ❌ | Artist name |
| `album` | `string` | ❌ | Album name |
| `artwork` | `string` | ❌ | Cover art image URL |
| `duration` | `number` | ❌ | Track duration in seconds |

## Visualization Types

### 1. Bars (Default)
Classic frequency bars visualization that responds to audio amplitude.

```tsx
<UiAudioPlayer
  src="/audio/song.mp3"
  visualizerType="bars"
  visualizerColor={['#00f5ff', '#667eea', '#764ba2']}
/>
```

### 2. Wave
Smooth waveform visualization showing audio frequencies as a continuous line.

```tsx
<UiAudioPlayer
  src="/audio/song.mp3"
  visualizerType="wave"
  visualizerColor="#667eea"
/>
```

### 3. Circular
Radial frequency visualization emanating from the center.

```tsx
<UiAudioPlayer
  src="/audio/song.mp3"
  visualizerType="circular"
  visualizerColor={['#ff006e', '#fb5607', '#ffbe0b']}
/>
```

### 4. Particles
Particle-based visualization with dynamic positioning based on audio data.

```tsx
<UiAudioPlayer
  src="/audio/song.mp3"
  visualizerType="particles"
  visualizerColor={['#06ffa5', '#00d9ff', '#b15eff']}
/>
```

### 5. Frequency
Gradient frequency bars with smooth color transitions.

```tsx
<UiAudioPlayer
  src="/audio/song.mp3"
  visualizerType="frequency"
  visualizerColor={['#4cc9f0', '#4361ee', '#3a0ca3', '#7209b7', '#f72585']}
/>
```

## Advanced Examples

### Custom Colored Player

```tsx
<UiAudioPlayer
  src="/audio/song.mp3"
  visualizerType="bars"
  visualizerColor={['#ff0080', '#ff8c00', '#40e0d0']}
  backgroundColor={['#1a1a2e', '#16213e', '#0f3460']}
  style={{
    maxWidth: '600px',
    margin: '0 auto',
    borderRadius: '16px',
  }}
/>
```

### Event Handling

```tsx
const MyComponent = () => {
  const handlePlay = () => {
    console.log('Music started!');
    // Track analytics, update UI, etc.
  };

  const handleTimeUpdate = (currentTime: number, duration: number) => {
    const progress = (currentTime / duration) * 100;
    console.log(`Progress: ${progress.toFixed(2)}%`);
  };

  return (
    <UiAudioPlayer
      src="/audio/song.mp3"
      onPlay={handlePlay}
      onPause={() => console.log('Paused')}
      onEnded={() => console.log('Track ended')}
      onTimeUpdate={handleTimeUpdate}
      onVolumeChange={(vol) => console.log(`Volume: ${vol}`)}
    />
  );
};
```

### Minimal Player (No Visualization)

```tsx
<UiAudioPlayer
  src="/audio/podcast.mp3"
  showVisualization={false}
  visualizerType="bars"
  style={{
    background: 'linear-gradient(135deg, #2d3561 0%, #1f2937 100%)',
    minHeight: '120px',
  }}
/>
```

## Styling

The component uses SCSS modules and can be customized via:

1. **Props**: `className`, `style`, `visualizerColor`, `backgroundColor`
2. **CSS Variables**: Override component CSS variables
3. **SCSS Overrides**: Import and extend the component's SCSS

### Light Mode Variant

```tsx
<UiAudioPlayer
  src="/audio/song.mp3"
  className="light"
/>
```

## Browser Compatibility

- ✅ Chrome/Edge (88+)
- ✅ Firefox (89+)
- ✅ Safari (14+)
- ✅ Mobile browsers (iOS Safari 14+, Chrome Mobile)

**Note**: Web Audio API is required for visualizations. The player will function without it but visualizations won't display.

## Performance

- Canvas rendering optimized with `requestAnimationFrame`
- Automatic cleanup of audio contexts and event listeners
- Efficient state management with React class component lifecycle
- Minimal re-renders with targeted state updates

## File Structure

```
UiAudioPlayer/
├── controller/
│   ├── UiAudioPlayer.tsx      # Main component logic
│   └── UiAudioPlayer.scss     # Component styles
├── views/
│   ├── UiAudioPlayerDemo.tsx  # Demo/example component
│   └── UiAudioPlayerDemo.scss # Demo styles
├── types/
│   └── index.ts               # TypeScript interfaces
└── index.ts                   # Main export
```

## Inspiration

This component was inspired by:
- [Visicality](https://visicality.derekwolpert.com/) - Beautiful web-based music visualizer
- Modern audio visualization techniques using Web Audio API and canvas

## Accessibility

- Semantic HTML with proper ARIA labels
- Keyboard navigation support
- Screen reader friendly controls
- Responsive design for all devices

## Future Enhancements

- [ ] Equalizer controls
- [ ] Custom visualizer plugins
- [ ] Waveform scrubbing
- [ ] Lyrics display
- [ ] Audio effects (reverb, echo, etc.)
- [ ] Spectrum analyzer mode
- [ ] Export visualization as video

## Contributing

When modifying this component:
1. Maintain the existing class component structure
2. Follow the webapp's component patterns
3. Test all visualization types
4. Ensure responsive design works
5. Update type definitions as needed

## License

Part of the MindBurn Network webapp component library.
