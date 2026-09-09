import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import { _s } from '../coerce';
import { buildDimensionFields, buildVideoFields } from '@Canopy/utils/form-field-builders';

export const overlayCameraFields = (ov: CanonOverlay): IFormField[] => {
  const data = (ov?.data ?? {}) as any;
  return [
    { name: 'data.pipelineSessionId', label: 'Pipeline Session ID',     type: 'text', value: _s(data?.pipelineSessionId ?? ''), width: '50%', readonly: true },
    { name: 'data.src',               label: 'Resolved HLS / Media URL', type: 'text', value: _s(data?.src               ?? ''), width: '50%', readonly: true },
    ...buildDimensionFields(data),
    ...buildVideoFields(data),
  ];
};

export const overlayScreenFields = (ov: CanonOverlay): IFormField[] =>
  overlayCameraFields(ov);
