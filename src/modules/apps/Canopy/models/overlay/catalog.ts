import type { OverlayType } from './types';
import { DISABLED_OVERLAY_TYPES, OVERLAY_MODELS } from '../overlayModels';

export const OVERLAY_TYPES = (Object.keys(OVERLAY_MODELS) as OverlayType[])
  .filter((type) => !DISABLED_OVERLAY_TYPES.has(type))
  .map((type) => ({ type, label: OVERLAY_MODELS[type].label }));

export const OVERLAY_TYPE_SET: any = new Set<OverlayType>(OVERLAY_TYPES.map((o) => o.type));
