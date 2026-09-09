import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import { _n } from '../coerce';

export const overlayTickerFields = (ov: CanonOverlay): IFormField[] => {
  const data = (ov?.data ?? {}) as any;
  const items: string[] = Array.isArray(data?.items)
    ? data.items
        .map((txt: any) => {
          if (typeof txt === 'string') return txt.trim();
          if (txt == null) return '';
          return String(txt).trim();
        })
        .filter(Boolean)
    : [];

  return [
    {
      name:        'data.items',
      label:       'Ticker items',
      type:        'multi-select',
      value:       items,
      options:     items.map((txt) => ({ label: txt, value: txt })),
      input:       true,
      width:       '100%',
      placeholder: 'Add text and press enter',
    } as IFormField,
    {
      name:  'data.width_pct',
      label: 'Width (%)',
      type:  'number',
      value: _n(data?.width_pct ?? data?.width ?? 100),
      min:   1, max: 100, step: 1, width: '50%',
    },
    {
      name:  'data.height_pct',
      label: 'Height (%)',
      type:  'number',
      value: _n(data?.height_pct ?? data?.height ?? 5),
      min:   1, max: 100, step: 1, width: '50%',
    },
  ];
};
