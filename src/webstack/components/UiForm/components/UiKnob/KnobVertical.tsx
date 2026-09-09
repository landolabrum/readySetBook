import React, { useMemo } from 'react';
import styles from './UiKnob.scss';
import type { KnobState } from './audioKnobMath';
import { useKnobDrag } from './useKnobDrag';

type Props = {
  state: KnobState;
  audioLevel?: number;
  label?: string;
  measureBy?: 'percent' | 'decibel';
  onChange?: (s: KnobState) => void;
};

const TRACK_HEIGHT = 120;

const KnobVertical: React.FC<Props> = ({ state, audioLevel = 0, label, measureBy, onChange }) => {
  const { onPointerDown } = useKnobDrag(state.normalized, onChange);

  const thumbY = useMemo(() => TRACK_HEIGHT * (1 - state.normalized), [state.normalized]);
  const levelH = useMemo(() => TRACK_HEIGHT * Math.max(0, Math.min(1, audioLevel)), [audioLevel]);

  const displayLabel = label ?? (measureBy === 'decibel'
    ? `${state.db > -60 ? state.db.toFixed(1) : '-∞'} dB`
    : `${state.percent}%`);

  return (
    <>
    <style jsx>{styles}</style>
    <div className="knob knob--vertical" style={{ touchAction: 'none' }}>
      <div className="knob__fader" onPointerDown={onPointerDown}>
        <div className="knob__fader-track" style={{ height: TRACK_HEIGHT }}>
          <div className="knob__fader-level" style={{ height: levelH }} />
          <div className="knob__fader-fill" style={{ height: TRACK_HEIGHT - thumbY }} />
          <div className="knob__fader-thumb" style={{ top: thumbY }} />
        </div>
      </div>
      <span className="knob__label">{displayLabel}</span>
    </div>
    </>
  );
};

export default KnobVertical;
