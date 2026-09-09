import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import type { CardBindingMode, CardBindingRosterRow, CardBindingSource, CardBindingSelectorType } from './types';
import { _s, _n } from '../coerce';
import { normalizeCardItems, defaultCardItem } from './defaults';
import {
  CARD_BINDING_SOURCE_OPTIONS,
  CARD_BINDING_MODE_OPTIONS,
  CARD_BINDING_SELECTOR_OPTIONS_BY_SOURCE,
  getCardBindingKeyOptions,
  buildCardBindingSelectorValueOptions,
} from './options';

export const overlayCardFields = (ov: CanonOverlay): IFormField[] => {
  const data = (ov?.data ?? {}) as any;
  return [
    { name: 'data.headline',       label: 'Card Headline',    type: 'text',   value: _s(data?.headline    ?? 'Stats Card'), width: '60%' },
    { name: 'data.subheadline',    label: 'Subheadline',      type: 'text',   value: _s(data?.subheadline ?? ''),           width: '40%' },
    { name: 'data.columns',        label: 'Columns',          type: 'number', value: _n(data?.columns      ?? 3, 3),  min: 1, max: 6,   step: 1, width: '25%' },
    { name: 'data.gap',            label: 'Gap (px)',         type: 'number', value: _n(data?.gap          ?? 10, 10), min: 0, max: 80,  step: 1, width: '25%' },
    { name: 'data.padding',        label: 'Padding (px)',     type: 'number', value: _n(data?.padding      ?? 12, 12), min: 0, max: 80,  step: 1, width: '25%' },
    { name: 'data.minItemHeight',  label: 'Min Height (px)',  type: 'number', value: _n(data?.minItemHeight ?? 90, 90), min: 40, max: 640, step: 1, width: '25%' },
    { name: 'data.background',     label: 'Panel BG',         type: 'text',   value: _s(data?.background     ?? '#0b1017dd'), width: '34%', placeholder: '#0b1017dd or linear-gradient(...)' },
    { name: 'data.itemBackground', label: 'Default Item BG',  type: 'text',   value: _s(data?.itemBackground ?? '#121c2bdd'), width: '33%' },
    { name: 'data.textColor',      label: 'Default Text',     type: 'text',   value: _s(data?.textColor      ?? '#f5f8ff'),   width: '33%' },
  ];
};

export const cardItemFields = (
  ov: CanonOverlay,
  index: number,
  extras?: { roster?: CardBindingRosterRow[] | null | undefined },
): IFormField[] => {
  const data  = (ov?.data ?? {}) as any;
  const items = normalizeCardItems(data?.items);
  const item  = items[index] ?? defaultCardItem();
  const pfx   = `data.items.${index}`;

  const sourceRaw = _s(item?.binding?.source ?? 'static');
  const source    = (sourceRaw === 'event_teams' ? 'event_team' : sourceRaw) as CardBindingSource;
  const mode      = (source === 'gps' ? 'record' : _s(item?.binding?.mode ?? 'aggregate')) as CardBindingMode;

  const selectorType = (item?.binding?.selector?.type
    ?? (((item?.binding as any)?.teamNumber ? 'vehicle_number' : undefined) as CardBindingSelectorType | undefined)
    ?? (source === 'event_team' && mode === 'record' ? 'leader' : source === 'gps' ? 'first_available' : undefined));

  const selectorOptions      = CARD_BINDING_SELECTOR_OPTIONS_BY_SOURCE[source] ?? [];
  const selectorValueOptions = buildCardBindingSelectorValueOptions(extras?.roster, selectorType);
  const keyOptions           = getCardBindingKeyOptions(source, mode);

  const fields: IFormField[] = [
    { name: `${pfx}.title`,       label: 'Title',       type: 'text',   value: _s(item?.title       ?? ''), width: '50%' },
    { name: `${pfx}.value`,       label: 'Value',       type: 'text',   value: _s(item?.value       ?? ''), width: '50%' },
    { name: `${pfx}.subtitle`,    label: 'Subtitle',    type: 'text',   value: _s(item?.subtitle    ?? ''), width: '50%' },
    { name: `${pfx}.description`, label: 'Description', type: 'text',   value: _s(item?.description ?? ''), width: '50%' },
    { name: `${pfx}.imageUrl`,    label: 'Image URL',   type: 'text',   value: _s(item?.imageUrl    ?? ''), width: '100%' },
    { name: `${pfx}.colSpan`,     label: 'Col Span',    type: 'number', value: _n(item?.colSpan ?? 1, 1), min: 1, max: 6, step: 1, width: '25%' },
    { name: `${pfx}.rowSpan`,     label: 'Row Span',    type: 'number', value: _n(item?.rowSpan ?? 1, 1), min: 1, max: 6, step: 1, width: '25%' },
    { name: `${pfx}.background`,  label: 'Item BG',     type: 'text',   value: _s(item?.background ?? ''), width: '25%' },
    { name: `${pfx}.textColor`,   label: 'Text Color',  type: 'text',   value: _s(item?.textColor  ?? ''), width: '25%' },
    { name: `${pfx}.binding.source`, label: 'Data Source', type: 'select', value: source, options: CARD_BINDING_SOURCE_OPTIONS, width: '33%' },
  ];

  if (source === 'event_team') {
    fields.push({ name: `${pfx}.binding.mode`, label: 'Binding Mode', type: 'select', value: mode, options: CARD_BINDING_MODE_OPTIONS, width: '33%' });
  }

  if ((source === 'event_team' && mode === 'record') || source === 'gps') {
    fields.push({ name: `${pfx}.binding.selector.type`, label: 'Selector', type: 'select', value: _s(selectorType ?? ''), options: selectorOptions, width: selectorValueOptions.length ? '33%' : '50%' });
    if (selectorValueOptions.length) {
      fields.push({ name: `${pfx}.binding.selector.value`, label: selectorType === 'team_id' ? 'Team ID' : 'Vehicle Number', type: 'select', value: _s(item?.binding?.selector?.value ?? ((item?.binding as any)?.teamNumber ?? '')), options: selectorValueOptions, width: '34%' });
    }
  }

  fields.push(
    { name: `${pfx}.binding.key`,      label: 'Data Key',      type: 'select', value: _s(item?.binding?.key ?? ''),      options: keyOptions, width: source === 'static' || source === 'computed' || source === 'event_info' ? '67%' : '33%' },
    { name: `${pfx}.binding.prefix`,   label: 'Value Prefix',  type: 'text',   value: _s(item?.binding?.prefix   ?? ''), width: '25%', placeholder: 'e.g. #' },
    { name: `${pfx}.binding.suffix`,   label: 'Value Suffix',  type: 'text',   value: _s(item?.binding?.suffix   ?? ''), width: '25%', placeholder: 'e.g. mph' },
    { name: `${pfx}.binding.fallback`, label: 'Fallback',      type: 'text',   value: _s(item?.binding?.fallback ?? ''), width: '25%', placeholder: '--' },
    { name: `${pfx}.binding.decimals`, label: 'Decimals',      type: 'number', value: _n(item?.binding?.decimals ?? 0, 0), min: 0, max: 4, step: 1, width: '25%' },
  );

  return fields;
};
