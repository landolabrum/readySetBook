// Core types
export type { OverlayType, CanonOverlay, OverlayIdContext } from './types';

// Coercion + equality utilities
export { coerceEnabled, jsonStable, jsonEq } from './coerce';

// Catalog
export { OVERLAY_TYPES, OVERLAY_TYPE_SET } from './catalog';

// Defaults + normalization
export {
  defaultOverlayFor,
  mergeOverlay,
  normalizeOverlayArray,
  enabledOnly,
  realOverlaysOnly,
  enabledRealOverlaysOnly,
} from './defaults';

// Layout options + base field builder + reset tool
export {
  OVERLAY_VARIANT_OPTIONS,
  MEDIA_VARIANT_OPTIONS,
  WEATHER_VARIANT_OPTIONS,
  OVERLAY_ANIMATION_OPTIONS,
  resetOverlayLayout,
  overlayBaseFields,
} from './layout';

// Per-type field builders
export { overlayMapFields }                          from './fields/map';
export { overlayTickerFields }                       from './fields/ticker';
export { overlayHudFields }                          from './fields/hud';
export { overlayLapCounterFields }                   from './fields/lapcounter';
export { overlayShareFields, overlayEncoderFields }  from './fields/share';
export { overlayCameraFields, overlayScreenFields }  from './fields/camera';
export { overlayPullFields }                         from './fields/pull';
export { overlayWeatherFields }                      from './fields/weather';
export { overlayChatFields }                         from './fields/chat';

// Card subsystem
export type {
  CardBindingSource,
  CardBindingMode,
  CardBindingSelectorType,
  CardBindingSelector,
  CardBinding,
  CardBindingRosterRow,
  CardOverlayItem,
} from './card/types';
export { defaultCardItem, normalizeCardItems }       from './card/defaults';
export {
  CARD_BINDING_SOURCE_OPTIONS,
  CARD_BINDING_MODE_OPTIONS,
  CARD_BINDING_SELECTOR_OPTIONS_BY_SOURCE,
  getCardBindingKeyOptions,
  buildCardBindingSelectorValueOptions,
}                                                    from './card/options';
export { overlayCardFields, cardItemFields }         from './card/fields';

// Media segment subsystem
export type { MediaSegment }                         from './media/types';
export { defaultMediaSegment, normalizeSegments }    from './media/defaults';
export { multiviewFields, mediaSegmentFields, overlayMediaFields } from './media/fields';

// Dispatcher
export { overlayFieldsFor }                          from './fieldsFor';
