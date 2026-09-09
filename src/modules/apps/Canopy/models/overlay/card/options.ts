import type { CardBindingMode, CardBindingRosterRow, CardBindingSource, CardBindingSelectorType } from './types';

export const CARD_BINDING_SOURCE_OPTIONS = [
  { label: 'Static (manual text)', value: 'static' },
  { label: 'Event Info',           value: 'event_info' },
  { label: 'Event Team',           value: 'event_team' },
  { label: 'GPS Data',             value: 'gps' },
  { label: 'Computed',             value: 'computed' },
];

export const CARD_BINDING_MODE_OPTIONS = [
  { label: 'Single record', value: 'record' },
  { label: 'Aggregate',     value: 'aggregate' },
];

export const CARD_BINDING_SELECTOR_OPTIONS_BY_SOURCE: Partial<Record<CardBindingSource, Array<{ label: string; value: CardBindingSelectorType }>>> = {
  event_team: [
    { label: 'Leader',             value: 'leader' },
    { label: 'By Vehicle Number',  value: 'vehicle_number' },
    { label: 'By Team ID',         value: 'team_id' },
  ],
  gps: [
    { label: 'First Available GPS', value: 'first_available' },
    { label: 'By Vehicle Number',   value: 'vehicle_number' },
    { label: 'By Team ID',          value: 'team_id' },
  ],
};

const CARD_BINDING_KEY_OPTIONS_BY_SOURCE_MODE: Record<string, Array<{ label: string; value: string }>> = {
  'static:aggregate':       [{ label: 'manual value',    value: '' }],
  'event_info:aggregate':   [
    { label: 'name', value: 'name' }, { label: 'id', value: 'id' },
    { label: 'starts_at', value: 'starts_at' }, { label: 'ends_at', value: 'ends_at' },
    { label: 'timezone', value: 'timezone' }, { label: 'is_live', value: 'is_live' },
    { label: 'lat', value: 'lat' }, { label: 'lng', value: 'lng' },
    { label: 'design_width', value: 'design_width' }, { label: 'design_height', value: 'design_height' },
  ],
  'event_team:aggregate':   [
    { label: 'team_count', value: 'team_count' }, { label: 'leader_name', value: 'leader_name' },
    { label: 'leader_score', value: 'leader_score' }, { label: 'teams_with_gps', value: 'teams_with_gps' },
    { label: 'total_score', value: 'total_score' }, { label: 'average_score', value: 'average_score' },
  ],
  'event_team:record':      [
    { label: 'team_name', value: 'team_name' }, { label: 'vehicle_number', value: 'vehicle_number' },
    { label: 'score', value: 'score' }, { label: 'place', value: 'place' },
    { label: 'color', value: 'color' }, { label: 'competitor_1_name', value: 'competitor_1_name' },
    { label: 'competitor_count', value: 'competitor_count' }, { label: 'has_gps', value: 'has_gps' },
  ],
  'gps:record':             [
    { label: 'coords', value: 'coords' }, { label: 'lat', value: 'lat' },
    { label: 'lon', value: 'lon' }, { label: 'speed_mph', value: 'speed_mph' },
    { label: 'timestamp', value: 'timestamp' },
  ],
  'computed:aggregate':     [
    { label: 'team_count', value: 'team_count' }, { label: 'teams_with_gps', value: 'teams_with_gps' },
    { label: 'total_score', value: 'total_score' }, { label: 'average_score', value: 'average_score' },
    { label: 'leader_name', value: 'leader_name' }, { label: 'leader_score', value: 'leader_score' },
  ],
};

export const getCardBindingKeyOptions = (source: CardBindingSource, mode: CardBindingMode) =>
  CARD_BINDING_KEY_OPTIONS_BY_SOURCE_MODE[`${source}:${mode}`] ?? [{ label: 'manual value', value: '' }];

export const buildCardBindingSelectorValueOptions = (
  roster: CardBindingRosterRow[] | null | undefined,
  selectorType?: CardBindingSelectorType,
) => {
  const rows = Array.isArray(roster) ? roster : [];
  if (selectorType === 'vehicle_number') {
    return rows
      .filter((row) => row?.vehicle_number != null && String(row.vehicle_number).trim())
      .map((row) => ({
        label: `${String(row.vehicle_number)}${row?.team_name ? ` - ${String(row.team_name)}` : ''}`,
        value: String(row.vehicle_number),
      }));
  }
  if (selectorType === 'team_id') {
    return rows
      .filter((row) => row?.id != null && String(row.id).trim())
      .map((row) => ({
        label: `${String(row.team_name || row.id)}${row?.vehicle_number != null ? ` (#${String(row.vehicle_number)})` : ''}`,
        value: String(row.id),
      }));
  }
  return [];
};
