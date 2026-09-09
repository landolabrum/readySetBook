import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import { _n } from '../coerce';

export const overlayChatFields = (ov: CanonOverlay): IFormField[] => {
  const data = (ov?.data ?? {}) as any;
  const channel = typeof data?.channel === 'string' ? data.channel : '';

  return [
    {
      name:        'data.channel',
      label:       'Twitch channel',
      type:        'text',
      value:       channel,
      width:       '100%',
      placeholder: 'e.g. iprogramthem',
    } as IFormField,
    {
      name:  'data.maxMessages',
      label: 'Max messages',
      type:  'number',
      value: _n(data?.maxMessages ?? 50),
      min:   1, max: 500, step: 1, width: '100%',
    },
    {
      name:  'data.showBadges',
      label: 'Show badges',
      type:  'checkbox',
      value: typeof data?.showBadges === 'boolean' ? data.showBadges : true,
      width: '50%',
    } as IFormField,
    {
      name:  'data.showColors',
      label: 'Show colors',
      type:  'checkbox',
      value: typeof data?.showColors === 'boolean' ? data.showColors : true,
      width: '50%',
    } as IFormField,
  ];
};
