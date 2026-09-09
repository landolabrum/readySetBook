import { useCallback, useMemo, useRef, useState } from 'react';
import { useCanopyViewState } from '@Canopy/hooks/useCanopyViewState';
import { useAudioLevelListener } from '@webstack/hooks/audio/useAudioLevelListener';
import { buildKnobState, type KnobState } from '@webstack/components/UiForm/components/UiKnob/audioKnobMath';
import type { EventRow } from '@Canopy/hooks/useCanopy';
import type { CanonOverlay, OverlayType } from '@Canopy/models/canopyOverlayTypes';

const CHANNEL_NAME = 'canopy-media-control';

export type AudioOverlayType = Extract<OverlayType, 'media' | 'camera' | 'screen' | 'encoder' | 'pull'>;

export const AUDIO_OVERLAY_TYPES: readonly AudioOverlayType[] = [
  'media',
  'camera',
  'screen',
  'encoder',
  'pull',
];

const AUDIO_TYPE_SET = new Set<AudioOverlayType>(AUDIO_OVERLAY_TYPES);

const isAudioOverlayType = (type: OverlayType): type is AudioOverlayType => {
  return AUDIO_TYPE_SET.has(type as AudioOverlayType);
};

const isAudioOverlay = (ov: CanonOverlay): ov is CanonOverlay & { type: AudioOverlayType } => {
  return isAudioOverlayType(ov.type);
};

export type OverlayAudio = {
  id: string;
  label: string;
  type: AudioOverlayType;
  volume: number;
  level: number;
  enabled: boolean;
};

export function useAudioPanel(current: EventRow | null) {
  const { overlays, updateOverlay } = useCanopyViewState(current);
  const { peakLevel, overlayLevels } = useAudioLevelListener();
  const channelRef = useRef<BroadcastChannel | null>(null);

  if (typeof window !== 'undefined' && !channelRef.current && window.BroadcastChannel) {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);
  }

  const enabled = useMemo(
    () => (overlays ?? []).filter((o: CanonOverlay) => o.enabled),
    [overlays],
  );

  const initialVol = useMemo(() => {
    if (!enabled.length) return 1;
    const vols = enabled.map((o: any) => typeof o.data?.volume === 'number' ? o.data.volume : 1);
    vols.sort((a: number, b: number) => a - b);
    return vols[Math.floor(vols.length / 2)];
  }, [enabled]);

  const [volume, setVolumeState] = useState(initialVol);
  const [muted, setMuted] = useState(false);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    for (const ov of enabled) {
      if (ov.id) updateOverlay(ov.id, { data: { ...((ov as any).data ?? {}), volume: clamped } });
    }
    try {
      channelRef.current?.postMessage({ action: 'volume', overlayId: 'all', value: clamped, ts: Date.now() });
    } catch {}
  }, [enabled, updateOverlay]);

  const setOverlayVolume = useCallback((id: string, v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    const all = overlays ?? [];
    const ov = all.find((o: CanonOverlay) => String(o.id) === id);
    if (ov) {
      updateOverlay(id, { data: { ...((ov as any).data ?? {}), volume: clamped } });
    }
    try {
      channelRef.current?.postMessage({ action: 'volume', overlayId: id, value: clamped, ts: Date.now() });
    } catch {}
  }, [overlays, updateOverlay]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    for (const ov of enabled) {
      if (ov.id) updateOverlay(ov.id, { data: { ...((ov as any).data ?? {}), muted: next } });
    }
    try {
      channelRef.current?.postMessage({
        action: next ? 'mute' : 'unmute', overlayId: 'all', ts: Date.now(),
      });
    } catch {}
  }, [muted, enabled, updateOverlay]);

  const knobState: KnobState = useMemo(() => buildKnobState(volume), [volume]);

  /** Per-overlay audio info for individual knobs */
  const overlayAudioList: OverlayAudio[] = useMemo(() => {
    const all = overlays ?? [];
    return all
      .filter(isAudioOverlay)
      .map((ov) => {
        const id = String(ov.id ?? '');
        const title = typeof ov.title === 'string' && ov.title && !ov.title.startsWith('::') ? ov.title : '';
        const label = ov.label || title || ov.type || 'overlay';
        const suffix = title && ov.label && title !== ov.label ? ` | ${title}` : '';
        return {
          id,
          label: `${label}${suffix}`,
          type: ov.type,
          volume: typeof (ov as any).data?.volume === 'number' ? (ov as any).data.volume : 1,
          level: overlayLevels.get(id) ?? 0,
          enabled: Boolean(ov.enabled),
        };
      });
  }, [overlays, overlayLevels]);

  return {
    volume, muted, setVolume, setOverlayVolume, toggleMute,
    audioLevel: peakLevel, knobState, overlayAudioList,
  };
}
