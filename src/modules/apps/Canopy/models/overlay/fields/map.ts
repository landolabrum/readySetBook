import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import { _s, _n, _toFloatOrUndef } from '../coerce';

export const overlayMapFields = (
  ov: CanonOverlay,
  eventDefaults?: { lat?: number | null; lng?: number | null },
): IFormField[] => {
  const data = (ov?.data ?? {}) as any;

  const locationValue = {
    lat: _toFloatOrUndef(data?.lat) ?? _toFloatOrUndef(eventDefaults?.lat) ?? 0,
    lng: _toFloatOrUndef(data?.lng) ?? _toFloatOrUndef(eventDefaults?.lng) ?? 0,
    line1:       data?.address?.line1       ?? '',
    line2:       data?.address?.line2       ?? '',
    city:        data?.address?.city        ?? '',
    state:       data?.address?.state       ?? '',
    postal_code: data?.address?.postal_code ?? '',
    country:     data?.address?.country     ?? '',
  };

  // GPS sources (team/guardian) handled by CanopyGpsSourcePicker sibling in buildOverlayViewEntries
  return [
    { name: 'data.location',     label: 'Center Location', type: 'address', value: locationValue, width: '100%' },
    { name: 'data.src',          label: 'Tile/Img URL',    type: 'text',    value: _s(data?.src) },
    { name: 'data.zoom',         label: 'Zoom',            type: 'number',  value: _n(data?.zoom ?? 12),   min: 0, max: 24, width: '500px' },
    { name: 'data.opacity',      label: 'Opacity (0–1)',   type: 'number',  value: _n(data?.opacity ?? 1), min: 0, max: 1, step: 0.5, width: '500px' },
    { name: 'data.manualCenter', label: 'Manual center',   type: 'checkbox', value: Boolean(data?.manualCenter), width: '500px' },
  ];
};
