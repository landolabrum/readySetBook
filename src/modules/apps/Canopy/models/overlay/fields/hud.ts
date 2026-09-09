import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import { _s } from '../coerce';

export const overlayHudFields = (ov: CanonOverlay): IFormField[] => {
  const data = (ov?.data ?? {}) as any;
  // GPS source is now handled by CanopyGpsSourcePicker (rendered as a sibling in buildOverlayViewEntries)
  return [
    {
      name:        'data.timestamp',
      label:       'Timestamp',
      type:        'text',
      value:       _s(data?.timestamp ?? ''),
      width:       '100%',
      readonly:    true,
      placeholder: 'auto from live GPS',
    },
  ];
};
