import { useCallback, useEffect, useRef, useState } from 'react';

const CHANNEL_NAME = 'canopy-media-control';
const SAMPLE_MS = 60;

interface UseAudioMeterOpts {
  videoEl?: HTMLVideoElement | null;
  stream?: MediaStream | null;
  overlayId?: string;
}

/**
 * Attach a Web Audio analyser to a <video> element or MediaStream.
 * Returns `{ level, ref }` — assign `ref` as a callback-ref on a <video>,
 * or pass `videoEl` directly when the element is managed by another hook.
 */
export function useAudioMeter({ videoEl, stream, overlayId }: UseAudioMeterOpts = {}) {
  const [level, setLevel] = useState(0);
  const [cbEl, setCbEl] = useState<HTMLVideoElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioNode | null>(null);
  const rafRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  /** Callback ref — pass to <video ref={ref}> when you don't already have an element */
  const ref = useCallback((node: HTMLVideoElement | null) => { setCbEl(node); }, []);

  // Prefer explicitly passed element, fall back to callback-ref element
  const el = videoEl ?? cbEl;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;
    return () => { try { ch.close(); } catch {} channelRef.current = null; };
  }, []);

  useEffect(() => {
    const src = stream;
    if (!el && !src) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    ctxRef.current = audioCtx;
    analyserRef.current = analyser;

    try {
      const node = src
        ? audioCtx.createMediaStreamSource(src)
        : audioCtx.createMediaElementSource(el!);
      node.connect(analyser);
      if (!src) analyser.connect(audioCtx.destination);
      sourceRef.current = node;
    } catch { return; }

    const buf = new Uint8Array(analyser.frequencyBinCount);
    let lastPost = 0;

    const tick = () => {
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length) / 255;
      setLevel(rms);

      const now = performance.now();
      if (overlayId && now - lastPost > SAMPLE_MS) {
        lastPost = now;
        try {
          channelRef.current?.postMessage({
            action: 'audio-level', overlayId, level: rms, ts: Date.now(),
          });
        } catch {}
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      try { sourceRef.current?.disconnect(); } catch {}
      try { analyser.disconnect(); } catch {}
      if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
      ctxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [el, stream, overlayId]);

  return { level, ref };
}
