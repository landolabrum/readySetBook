import type { CardBinding, CardBindingMode, CardBindingSource, CardOverlayItem } from '@Canopy/models/canopyOverlayTypes';
import type { OverlayRenderContext } from '@Canopy/lib/overlayRegistry';

export type CardRuntimeTeam = {
  id?: string | number;
  name?: string;
  team_name?: string;
  vehicle_number?: string | number;
  place?: number;
  score?: number;
  color?: string;
  gps?: string;
  speedMph?: number;
  gps_data?: { last_fix?: any; created_at?: string | null; updated_at?: string | null } | null;
};

export type CardRuntimeData = {
  eventInfo: Record<string, any>;
  teams: CardRuntimeTeam[];
  teamByVehicleNumber: Map<string, CardRuntimeTeam>;
  teamById: Map<string, CardRuntimeTeam>;
  leaderTeam?: CardRuntimeTeam;
  firstGpsTeam?: CardRuntimeTeam;
  computed: {
    team_count: number;
    teams_with_gps: number;
    total_score: number;
    average_score: number;
    leader_name: string;
    leader_score: number | '';
  };
};

const getByPath = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
};

const parseGps = (raw?: string): { lat?: number; lon?: number } => {
  if (!raw) return {};
  const [latS, lonS] = String(raw).split(',').map((s) => s.trim());
  const lat = Number(latS);
  const lon = Number(lonS);
  return {
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
  };
};

const toSource = (binding?: CardBinding): CardBindingSource => {
  const raw = String(binding?.source || 'static').toLowerCase();
  if (raw === 'event_teams') return 'event_team';
  if (raw === 'event_team' || raw === 'event_info' || raw === 'gps' || raw === 'computed') return raw;
  return 'static';
};

const toMode = (binding?: CardBinding, source?: CardBindingSource): CardBindingMode => {
  const raw = String(binding?.mode || '').toLowerCase();
  if (raw === 'record' || raw === 'aggregate') return raw;
  if (source === 'event_team') return 'aggregate';
  if (source === 'gps') return 'record';
  return 'aggregate';
};

const getLegacySelector = (binding?: CardBinding) => {
  const legacyValue = String((binding as any)?.teamNumber ?? '').trim();
  return legacyValue ? { type: 'vehicle_number', value: legacyValue } : undefined;
};

const formatValue = (raw: any, binding?: CardBinding): string => {
  let value: any = raw;
  const decimals = Number(binding?.decimals);
  if (Number.isFinite(decimals) && Number.isFinite(Number(value))) {
    value = Number(value).toFixed(Math.max(0, Math.min(4, decimals)));
  }

  const text = value == null || value === '' ? String(binding?.fallback ?? '') : String(value);
  const prefix = binding?.prefix ? String(binding.prefix) : '';
  const suffix = binding?.suffix ? String(binding.suffix) : '';
  return `${prefix}${text}${suffix}`;
};

const selectTeam = (binding: CardBinding | undefined, runtime: CardRuntimeData): CardRuntimeTeam | undefined => {
  const selector = binding?.selector || getLegacySelector(binding);
  const type = String(selector?.type || '').trim();
  const value = String(selector?.value || '').trim();

  if (type === 'leader') return runtime.leaderTeam;
  if (type === 'first_available') return runtime.firstGpsTeam;
  if (type === 'vehicle_number') return value ? runtime.teamByVehicleNumber.get(value) : undefined;
  if (type === 'team_id') return value ? runtime.teamById.get(value) : undefined;
  return undefined;
};

export const buildCardRuntimeData = (
  ctx: OverlayRenderContext,
  overlayData: any,
  overlayTitle?: string | null
): CardRuntimeData => {
  const teams = Array.isArray(ctx.enrichTeams([] as any)) ? (ctx.enrichTeams([] as any) as CardRuntimeTeam[]) : [];
  const eventInfo = {
    id: ctx?.eventMeta?.id ?? overlayData?.eventInfo?.id ?? null,
    name: ctx?.eventMeta?.name ?? overlayData?.eventInfo?.name ?? overlayTitle ?? '',
    lat: ctx?.eventMeta?.lat ?? overlayData?.eventInfo?.lat ?? null,
    lng: ctx?.eventMeta?.lng ?? overlayData?.eventInfo?.lng ?? null,
    ...((typeof ctx?.eventMeta === 'object' && ctx?.eventMeta) || {}),
    ...((typeof overlayData?.eventInfo === 'object' && overlayData?.eventInfo) || {}),
  };

  const teamByVehicleNumber = new Map<string, CardRuntimeTeam>();
  const teamById = new Map<string, CardRuntimeTeam>();
  for (const team of teams) {
    const vehicle = team?.vehicle_number != null ? String(team.vehicle_number).trim() : '';
    const id = team?.id != null ? String(team.id).trim() : '';
    if (vehicle) teamByVehicleNumber.set(vehicle, team);
    if (id) teamById.set(id, team);
  }

  const leaderTeam = [...teams].sort((a, b) => Number(b?.score ?? 0) - Number(a?.score ?? 0))[0];
  const firstGpsTeam = teams.find((team) => {
    const vehicle = team?.vehicle_number != null ? String(team.vehicle_number).trim() : '';
    const id = team?.id != null ? String(team.id).trim() : '';
    return Boolean(team?.gps || (vehicle && ctx.gps.get(vehicle)) || (id && ctx.gps.get(id)));
  });

  const totalScore = teams.reduce((sum, team) => sum + (Number.isFinite(Number(team?.score)) ? Number(team?.score) : 0), 0);
  const teamsWithGps = teams.filter((team) => {
    const vehicle = team?.vehicle_number != null ? String(team.vehicle_number).trim() : '';
    const id = team?.id != null ? String(team.id).trim() : '';
    const gpsRaw = team?.gps || (vehicle && ctx.gps.get(vehicle)) || (id && ctx.gps.get(id));
    return typeof gpsRaw === 'string' && gpsRaw.includes(',');
  }).length;

  return {
    eventInfo,
    teams,
    teamByVehicleNumber,
    teamById,
    leaderTeam,
    firstGpsTeam,
    computed: {
      team_count: teams.length,
      teams_with_gps: teamsWithGps,
      total_score: totalScore,
      average_score: teams.length ? totalScore / teams.length : 0,
      leader_name: leaderTeam?.name || leaderTeam?.team_name || '',
      leader_score: leaderTeam?.score ?? '',
    },
  };
};

export const resolveCardItemValue = (item: CardOverlayItem, runtime: CardRuntimeData, ctx: OverlayRenderContext): string => {
  const binding = item?.binding;
  const source = toSource(binding);
  const mode = toMode(binding, source);
  const key = String(binding?.key || '').trim();

  if (!key || source === 'static') return formatValue(item?.value ?? '', binding);

  if (source === 'event_info') {
    return formatValue(getByPath(runtime.eventInfo, key), binding);
  }

  if (source === 'event_team') {
    if (mode === 'aggregate') {
      if (key in runtime.computed) return formatValue((runtime.computed as any)[key], binding);
      return formatValue('', binding);
    }

    const team = selectTeam(binding, runtime);
    if (!team) return formatValue('', binding);
    if (key === 'team_name') return formatValue(team?.name || team?.team_name || '', binding);
    if (key === 'competitor_count') return formatValue(Array.isArray((team as any)?.competitors) ? (team as any).competitors.length : 0, binding);
    if (key === 'competitor_1_name') {
      const first = Array.isArray((team as any)?.competitors) ? (team as any).competitors[0] : undefined;
      return formatValue(first?.name || '', binding);
    }
    if (key === 'has_gps') {
      const vehicle = team?.vehicle_number != null ? String(team.vehicle_number).trim() : '';
      const id = team?.id != null ? String(team.id).trim() : '';
      const gpsRaw = team?.gps || (vehicle && ctx.gps.get(vehicle)) || (id && ctx.gps.get(id));
      return formatValue(Boolean(gpsRaw), binding);
    }
    return formatValue(getByPath(team, key), binding);
  }

  if (source === 'gps') {
    const team = selectTeam(binding, runtime);
    if (!team) return formatValue('', binding);
    const vehicle = team?.vehicle_number != null ? String(team.vehicle_number).trim() : '';
    const id = team?.id != null ? String(team.id).trim() : '';
    const gpsRaw = team?.gps || (vehicle && ctx.gps.get(vehicle)) || (id && ctx.gps.get(id)) || '';
    const point = parseGps(gpsRaw);

    if (key === 'coords') return formatValue(gpsRaw, binding);
    if (key === 'lat') return formatValue(point.lat ?? '', binding);
    if (key === 'lon') return formatValue(point.lon ?? '', binding);
    if (key === 'speed_mph') {
      const ref = vehicle || id;
      const mph = team?.speedMph ?? (ref ? ctx.lastSpeedRef.current.get(ref) : undefined);
      return formatValue(mph ?? '', binding);
    }
    if (key === 'timestamp') {
      const ts = (team as any)?.gps_data?.updated_at || (team as any)?.gps_data?.created_at || '';
      return formatValue(ts, binding);
    }
    return formatValue('', binding);
  }

  if (source === 'computed') {
    return formatValue((runtime.computed as any)[key], binding);
  }

  return formatValue(item?.value ?? '', binding);
};
