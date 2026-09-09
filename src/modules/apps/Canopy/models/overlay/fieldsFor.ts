import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay, OverlayType } from './types';
import { overlayBaseFields } from './layout';
import { overlayMapFields }        from './fields/map';
import { overlayTickerFields }     from './fields/ticker';
import { overlayHudFields }        from './fields/hud';
import { overlayLapCounterFields } from './fields/lapcounter';
import { overlayShareFields, overlayEncoderFields } from './fields/share';
import { overlayCameraFields, overlayScreenFields } from './fields/camera';
import { overlayPullFields }       from './fields/pull';
import { overlayWeatherFields }    from './fields/weather';
import { overlayCardFields }       from './card/fields';
import { overlayChatFields }       from './fields/chat';
import { overlayMediaFields }      from './media/fields';

export const overlayFieldsFor = (
  type: OverlayType,
  ov: CanonOverlay,
  extras?: {
    eventDefaults?:     { lat?: number | null; lng?: number | null };
    showAdvancedFields?: boolean;
  },
): IFormField[] => {
  const base = overlayBaseFields(ov, type, extras?.showAdvancedFields ?? true);
  if (type === 'ticker')     return [...overlayTickerFields(ov), ...base];
  if (type === 'map')        return [...base, ...overlayMapFields(ov, extras?.eventDefaults)];
  if (type === 'hud')        return [...base, ...overlayHudFields(ov)];
  if (type === 'lapcounter') return [...base, ...overlayLapCounterFields(ov)];
  if (type === 'media')      return [...base, ...overlayMediaFields(ov)];
  if (type === 'weather')    return [...overlayWeatherFields(ov, extras?.eventDefaults), ...base];
  if (type === 'camera')     return [...overlayCameraFields(ov), ...base];
  if (type === 'screen')     return [...overlayScreenFields(ov), ...base];
  if (type === 'encoder')    return [...overlayEncoderFields(ov), ...base];
  if (type === 'pull')       return [...overlayPullFields(ov), ...base];
  if (type === 'card')       return [...overlayCardFields(ov), ...base];
  if (type === 'chat')       return [...overlayChatFields(ov), ...base];
  return base;
};
