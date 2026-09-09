import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import { _s, _n } from '../coerce';

export const overlayWeatherFields = (
  ov: CanonOverlay,
  _eventDefaults?: { lat?: number | null; lng?: number | null },
): IFormField[] => {
  const data = (ov?.data ?? {}) as any;

  // GPS source is now handled by CanopyGpsSourcePicker (rendered as a sibling in buildOverlayViewEntries)
  const fields: IFormField[] = [];

  if (_s(ov?.variant ?? 'default') === 'surf') {
    fields.push(
      { name: 'data.surfMaxBeachSearchKm', label: 'Max Beach Search (km)', type: 'number', value: _n(data?.surfMaxBeachSearchKm ?? 60, 60), min: 1,  max: 250, step: 1, width: '34%' },
      { name: 'data.surfForecastHours',    label: 'Forecast Hours',        type: 'number', value: _n(data?.surfForecastHours    ?? 12, 12), min: 3,  max: 48,  step: 1, width: '33%' },
      {
        name:    'data.surfUnits',
        label:   'Surf Units',
        type:    'select',
        value:   _s(data?.surfUnits ?? 'imperial'),
        options: [
          { label: 'Imperial (ft, mph, F)', value: 'imperial' },
          { label: 'Metric (m, km/h, C)',   value: 'metric' },
        ],
        width: '33%',
      },
    );
  }

  return fields;
};
