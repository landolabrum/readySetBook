import React, { useEffect, useState, useCallback, useRef } from 'react';
import styles from "./SurveillanceController.scss";
import UiJoyStick from '@webstack/components/UiForm/components/UiJoyStick/UiJoyStick';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import { getService } from '@webstack/common';
import ISurveillanceService from '~/src/core/services/SurveillanceService/ISurveillanceService';

interface IPtzPosition {
  horizontal: number;
  vertical: number;
}

interface ISurveillanceControlsProps {
  cameraId: string;
  initialPtz?: { horizontal?: number; vertical?: number } | null;
}

const SurveillanceController: React.FC<ISurveillanceControlsProps> = ({ cameraId, initialPtz }) => {
  const surveillance = getService<ISurveillanceService>('ISurveillanceService');
  const [ptz, setPtz] = useState<IPtzPosition>({
    horizontal: initialPtz?.horizontal ?? 0,
    vertical: initialPtz?.vertical ?? 0,
  });
  const [error, setError] = useState<string | null>(null);

  const ptzRef = useRef(ptz);
  ptzRef.current = ptz;

  // ── Request queue: only one in-flight at a time, abort stale ones ──
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ h: number; v: number } | null>(null);

  /** Fire exactly one PTZ request; queue the latest if busy */
  const dispatchMove = useCallback(
    async (h: number, v: number) => {
      // If a request is already in flight, just remember the latest target
      if (busyRef.current) {
        pendingRef.current = { h, v };
        return;
      }

      busyRef.current = true;

      // Abort any lingering previous request
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const url = surveillance.ptzPositionUrl(cameraId, h, v);
      console.log('[PTZ] →', url);

      try {
        const resp = await fetch(url, {
          credentials: 'include',
          signal: ac.signal,
        });
        if (!resp.ok) throw new Error(`PTZ ${resp.status}`);
        const data = await resp.json();
        console.log('[PTZ] ←', data);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          console.log('[PTZ] aborted (superseded)');
        } else {
          console.error('[PTZ] failed:', err);
          setError('Move failed');
          setTimeout(() => setError(null), 3000);
        }
      } finally {
        busyRef.current = false;

        // If a newer target arrived while we were busy, send it now
        const next = pendingRef.current;
        if (next) {
          pendingRef.current = null;
          dispatchMove(next.h, next.v);
        }
      }
    },
    [cameraId, surveillance],
  );

  /** Clamp & queue an absolute PTZ position */
  const sendMove = useCallback(
    (h: number, v: number) => {
      const clampH = Math.max(0, Math.min(350, Math.round(h)));
      const clampV = Math.max(0, Math.min(180, Math.round(v)));
      if (clampH === ptzRef.current.horizontal && clampV === ptzRef.current.vertical) return;

      setPtz({ horizontal: clampH, vertical: clampV });
      dispatchMove(clampH, clampV);
    },
    [dispatchMove],
  );

  /** Joystick → delta from current position */
  const handleJoystickMove = useCallback(
    (x: number, y: number) => {
      const STEP = 30;
      const RANGE = 50;
      const deltaH = Math.round((x / RANGE) * STEP);
      const deltaV = Math.round((-y / RANGE) * STEP);
      sendMove(ptzRef.current.horizontal + deltaH, ptzRef.current.vertical + deltaV);
    },
    [sendMove],
  );

  // Abort on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Sync when parent switches camera
  useEffect(() => {
    if (initialPtz) {
      setPtz({
        horizontal: initialPtz.horizontal ?? 0,
        vertical: initialPtz.vertical ?? 0,
      });
    }
  }, [cameraId]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className='surveillance-controller'>
        <div className='surveillance-controller--coordinates'>
          {error || `X: ${ptz.horizontal}, Y: ${ptz.vertical}`}
        </div>
        <div className='surveillance-controller--joystick'>
          <UiJoyStick onMove={handleJoystickMove} />
        </div>

        <UiInput
          value={ptz.vertical}
          min={0}
          max={180}
          onChange={(field) => {
            const v = Number(field?.target?.value ?? 0);
            sendMove(ptzRef.current.horizontal, v);
          }}
          label="vertical"
          type="range"
        />
        <UiInput
          value={ptz.horizontal}
          min={0}
          max={350}
          label="horizontal"
          onChange={(field) => {
            const h = Number(field?.target?.value ?? 0);
            sendMove(h, ptzRef.current.vertical);
          }}
          type="range"
        />
      </div>
    </>
  );
};

export default SurveillanceController;
