import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import { _n } from '../coerce';

export const overlayLapCounterFields = (ov: CanonOverlay): IFormField[] => {
  const data = (ov?.data ?? {}) as any;
  return [
    { name: 'data.currentLap', label: 'Current Lap', type: 'number', value: _n(data?.currentLap ?? 1, 1), min: 0, step: 1, width: '50%' },
    { name: 'data.totalLaps',  label: 'Total Laps',  type: 'number', value: data?.totalLaps == null ? 0 : _n(data.totalLaps, 0), min: 0, step: 1, width: '50%' },
  ];
};
