import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import { _s } from '../coerce';
import { buildDimensionFields, buildVideoFields } from '@Canopy/utils/form-field-builders';

export const overlayShareFields = (ov: CanonOverlay): IFormField[] => {
  const data = (ov?.data ?? {}) as any;
  return [
    { name: 'data.pipelineSessionId', label: 'Pipeline Session ID',     type: 'text', value: _s(data?.pipelineSessionId ?? ''), width: '50%', readonly: true },
    { name: 'data.src',               label: 'Resolved HLS / Media URL', type: 'text', value: _s(data?.src               ?? ''), width: '50%', readonly: true },
    { name: 'data.rtmpIngestUrl',     label: 'RTMP Ingest URL',         type: 'text', value: _s(data?.rtmpIngestUrl      ?? ''), width: '50%', readonly: true },
    { name: 'data.streamKey',         label: 'Stream Key',              type: 'text', value: _s(data?.streamKey          ?? ''), width: '50%', readonly: true },
    ...buildDimensionFields(data),
    ...buildVideoFields(data),
  ];
};

export const overlayEncoderFields = (ov: CanonOverlay): IFormField[] =>
  overlayShareFields(ov);
