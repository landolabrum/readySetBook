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

const RADIUS = 40;
const STROKE = 4;
const CENTER = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_FRACTION = 270 / 360;
const ARC_LEN = CIRCUMFERENCE * ARC_FRACTION;

const KnobRotary: React.FC<Props> = ({ state, audioLevel = 0, label, measureBy, onChange }) => {
  const { onPointerDown } = useKnobDrag(state.normalized, onChange);

  const levelOffset = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, audioLevel));
    return ARC_LEN * (1 - clamped);
  }, [audioLevel]);

  const displayLabel = label ?? (measureBy === 'decibel'
    ? `${state.db > -60 ? state.db.toFixed(1) : '-∞'} dB`
    : `${state.percent}%`);

  return (
    <>
    <style jsx>{styles}</style>
    <div className="knob knob--rotary" onPointerDown={onPointerDown} style={{ touchAction: 'none' }}>
      <svg className="knob__ring" viewBox="0 0 100 100">
        <circle
          className="knob__track"
          cx={CENTER} cy={CENTER} r={RADIUS}
          fill="none" strokeWidth={STROKE}
          strokeDasharray={`${ARC_LEN} ${CIRCUMFERENCE}`}
          strokeDashoffset={0}
          transform={`rotate(135 ${CENTER} ${CENTER})`}
        />
        <circle
          className="knob__level"
          cx={CENTER} cy={CENTER} r={RADIUS}
          fill="none" strokeWidth={STROKE}
          strokeDasharray={`${ARC_LEN} ${CIRCUMFERENCE}`}
          strokeDashoffset={levelOffset}
          transform={`rotate(135 ${CENTER} ${CENTER})`}
          strokeLinecap="round"
        />
        <circle
          className="knob__value"
          cx={CENTER} cy={CENTER} r={RADIUS}
          fill="none" strokeWidth={STROKE + 1}
          strokeDasharray={`${ARC_LEN * state.normalized} ${CIRCUMFERENCE}`}
          strokeDashoffset={0}
          transform={`rotate(135 ${CENTER} ${CENTER})`}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="knob__face"
        style={{ transform: `rotate(${state.angle}deg)` }}
      >
        <div className="knob__indicator" />
      </div>
      <span className="knob__label">{displayLabel}</span>
    </div>
    </>
  );
};

export default KnobRotary;
