import type { CardBindingSource, CardBindingMode, CardBindingSelectorType, CardOverlayItem } from './types';
import { clamp } from '../coerce';

const cardItemId = (): string => {
  if (typeof crypto !== 'undefined' && typeof (crypto as any)?.randomUUID === 'function') {
    return `card-item-${(crypto as any).randomUUID()}`;
  }
  return `card-item-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
};

export const defaultCardItem = (seed?: Partial<CardOverlayItem>): CardOverlayItem => ({
  id:          seed?.id || cardItemId(),
  title:       seed?.title       ?? 'Stat',
  value:       seed?.value       ?? '0',
  subtitle:    seed?.subtitle    ?? '',
  description: seed?.description ?? '',
  imageUrl:    seed?.imageUrl    ?? '',
  background:  seed?.background  ?? '',
  textColor:   seed?.textColor   ?? '',
  accent:      seed?.accent      ?? '',
  colSpan: Number.isFinite(Number(seed?.colSpan)) ? clamp(Number(seed?.colSpan), 1, 6) : 1,
  rowSpan: Number.isFinite(Number(seed?.rowSpan)) ? clamp(Number(seed?.rowSpan), 1, 6) : 1,
  binding: {
    source: (((seed?.binding as any)?.source === 'event_teams' ? 'event_team' : seed?.binding?.source) as CardBindingSource) ?? 'static',
    mode:   (seed?.binding?.mode as CardBindingMode) ?? ((((seed?.binding as any)?.source === 'gps') ? 'record' : undefined) ?? 'aggregate'),
    key:    seed?.binding?.key ?? '',
    selector: {
      type:
        seed?.binding?.selector?.type
        ?? (((seed?.binding as any)?.teamNumber ? 'vehicle_number' : undefined) as CardBindingSelectorType | undefined),
      value:
        seed?.binding?.selector?.value
        ?? ((seed?.binding as any)?.teamNumber ?? ''),
    },
    fallback: seed?.binding?.fallback ?? '',
    prefix:   seed?.binding?.prefix   ?? '',
    suffix:   seed?.binding?.suffix   ?? '',
    decimals: Number.isFinite(Number(seed?.binding?.decimals)) ? Number(seed?.binding?.decimals) : undefined,
  },
});

export const normalizeCardItems = (items: any): CardOverlayItem[] => {
  if (!Array.isArray(items)) return [defaultCardItem({ title: 'Headline', value: 'Ready' })];
  const normalized = items
    .map((it: any) => defaultCardItem(it))
    .filter((it: CardOverlayItem) => it && typeof it.id === 'string' && it.id.trim());
  return normalized.length ? normalized : [defaultCardItem({ title: 'Headline', value: 'Ready' })];
};
