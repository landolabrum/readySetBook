import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay, OverlayType } from './types';
import { OVERLAY_MODELS } from '../overlayModels';
import { _s, _n } from './coerce';

export const OVERLAY_VARIANT_OPTIONS = [
  { label: 'default',     value: 'default' },
  { label: 'blank',       value: 'blank' },
  { label: 'fullscreen',  value: 'fullscreen' },
  { label: 'image-left',  value: 'image-left' },
  { label: 'image-right', value: 'image-right' },
];

export const MEDIA_VARIANT_OPTIONS = [
  { label: 'default',    value: 'default' },
  { label: 'blank',      value: 'blank' },
  { label: 'multiview',  value: 'multiview' },
];

export const WEATHER_VARIANT_OPTIONS = [
  { label: 'default',    value: 'default' },
  { label: 'blank',      value: 'blank' },
  { label: 'time & temp', value: 'time-temp' },
  { label: 'today',      value: 'today' },
  { label: 'surf',       value: 'surf' },
];

export const OVERLAY_ANIMATION_OPTIONS = [
  { label: 'none',  value: 'none' },
  { label: 'fade',  value: 'fade' },
  { label: 'slide', value: 'slide' },
  { label: 'pop',   value: 'pop' },
];

const ADVANCED_LAYOUT_FIELDS = new Set([
  'z_index', 'x', 'y', 'width', 'height', 'crop_top', 'crop_bottom', 'crop_left', 'crop_right',
]);

/**
 * Reset the ADVANCED_LAYOUT_FIELDS of an overlay to their defaults.
 * x/y come from OVERLAY_MODELS[type].defaultPos, z_index resets to 1, and
 * width/height/crop_* are cleared to undefined (treated as "auto").
 * All other fields (id, type, enabled, variant, animation, label, title,
 * description, data) are preserved untouched.
 */
export const resetOverlayLayout = (ov: CanonOverlay): CanonOverlay => {
  const cfg = OVERLAY_MODELS[ov.type];
  return {
    ...ov,
    x: cfg?.defaultPos?.x ?? 0,
    y: cfg?.defaultPos?.y ?? 0,
    z_index: 1,
    width: undefined,
    height: undefined,
    crop: undefined,
  };
};

export const overlayBaseFields = (ov: CanonOverlay, type?: OverlayType, showAdvancedFields = true): IFormField[] => {
  const variantOptions =
    type === 'media' || type === 'camera' || type === 'screen' || type === 'encoder' || type === 'pull'
      ? MEDIA_VARIANT_OPTIONS
      : type === 'weather'
        ? WEATHER_VARIANT_OPTIONS
        : OVERLAY_VARIANT_OPTIONS;

  const rawVariant = _s(ov.variant ?? 'default');
  const variantValue = rawVariant === 'carousel' ? 'default' : rawVariant;

  const fields: IFormField[] = [
    { name: 'label', label: 'Label', type: 'markdown', value: _s(ov.label), placeholder: 'Display name for this overlay', variant: 'markdown' },
    { name: 'title',       label: 'Title',       type: 'markdown',   variant: 'markdown', value: _s(ov.title) },
    { name: 'description', label: 'Description', type: 'markdown',   variant: 'markdown', value: _s(ov.description) },
    { name: 'variant',     label: 'Variant',     type: 'select', value: variantValue, options: variantOptions, width: '50%' },
    { name: 'animation',   label: 'Animation',   type: 'select', value: _s(ov.animation ?? 'none'), options: OVERLAY_ANIMATION_OPTIONS, width: '50%' },
    { name: 'z_index',     label: 'Z-Index',     type: 'number', step: 1,  value: _n(ov.z_index), width: '15%' },
    { name: 'x',           label: 'X (%)',       type: 'number', value: _n(ov.x),      min: 0, max: 100,  step: 1 },
    { name: 'y',           label: 'Y (%)',       type: 'number', value: _n(ov.y),      min: 0, max: 100,  step: 1 },
    { name: 'width',       label: 'W (%)',       type: 'number', value: _n(ov.width),  min: 0,  step: 1 },
    { name: 'height',      label: 'H (%)',       type: 'number', value: _n(ov.height), min: 0,  step: 1 },
    { name: 'crop_top',    label: 'Crop Top',    type: 'number', value: _n(ov.crop?.[0]), placeholder: '0', min: 0, max: 100, step: 1, width: '25%' },
    { name: 'crop_bottom', label: 'Crop Bottom', type: 'number', value: _n(ov.crop?.[1]), placeholder: '0', min: 0, max: 100, step: 1, width: '25%' },
    { name: 'crop_left',   label: 'Crop Left',   type: 'number', value: _n(ov.crop?.[2]), placeholder: '0', min: 0, max: 100, step: 1, width: '25%' },
    { name: 'crop_right',  label: 'Crop Right',  type: 'number', value: _n(ov.crop?.[3]), placeholder: '0', min: 0, max: 100, step: 1, width: '25%' },
  ];

  if (showAdvancedFields) return fields;
  return fields.filter((field) => !ADVANCED_LAYOUT_FIELDS.has(String(field.name)));
};
