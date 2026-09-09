import React, { useMemo } from 'react';
import styles from './UiKnob.scss';
import { buildKnobState, type KnobState } from './audioKnobMath';
import KnobRotary from './KnobRotary';
import KnobVertical from './KnobVertical';

export type { KnobState } from './audioKnobMath';

interface IKnob {
  value: number;
  onChange?: (state: KnobState) => void;
  label?: string;
  measureBy?: 'percent' | 'decibel';
  audioLevel?: number;
  variant?: 'rotary' | 'vertical';
}

const UiKnob: React.FC<IKnob> = ({
  value, onChange, label, measureBy, audioLevel, variant = 'rotary',
}) => {
  const state = useMemo(() => buildKnobState(value), [value]);
  const View = variant === 'vertical' ? KnobVertical : KnobRotary;

  return (
    <>
      <style jsx>{styles}</style>
      <View
        state={state}
        audioLevel={audioLevel}
        label={label}
        measureBy={measureBy}
        onChange={onChange}
      />
    </>
  );
};

export default UiKnob;
