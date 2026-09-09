import type { OverlayIdContext, OverlayType } from './types';
import { DISABLED_OVERLAY_TYPES } from '../overlayModels';

// Alias map – kept here so normalizeOverlay doesn't re-create it each call.
const ALIAS_MAP: Record<string, OverlayType> = {
  scoreboard: 'scoreboard',
  leaderboard: 'scoreboard',
  score: 'scoreboard',
  gps: 'map',
  map: 'map',
  hud: 'hud',
  ticker: 'ticker',
  lapcounter: 'lapcounter',
  laps: 'lapcounter',
  media: 'media',
  camera: 'camera',
  screen: 'screen',
  encoder: 'encoder',
  rtmp: 'encoder',
  pull: 'pull',
  card: 'card',
  share: 'encoder',   // legacy migration
  device: 'encoder',  // legacy alias
  weather: 'weather',
  chat: 'chat',
};

/**
 * Normalise a raw string to a canonical OverlayType, resolving legacy aliases
 * and filtering disabled types. Returns null for unknown/disabled values.
 * @internal
 */
export const aliasType = (t: any): OverlayType | null => {
  const v = String(t ?? '').toLowerCase();
  if (!v) return null;
  const aliased = ALIAS_MAP[v] ?? null;
  if (!aliased || DISABLED_OVERLAY_TYPES.has(aliased)) return null;
  return aliased;
};

/**
 * Generate a stable (context-aware) or random overlay ID.
 * @internal
 */
export const idForType = (type: OverlayType, ctx?: OverlayIdContext): string => {
  const userId = ctx?.userId?.trim?.() || '';
  const streamId = ctx?.streamId?.trim?.() || '';
  if (userId && streamId) return `${userId}-${streamId}-${type}`;
  if (typeof crypto !== 'undefined' && typeof (crypto as any)?.randomUUID === 'function') {
    return `${type}-${(crypto as any).randomUUID()}`;
  }
  const rand = Math.floor(Math.random() * 1e9);
  const extra = Math.floor(performance?.now?.() ?? Date.now());
  return `${type}-${Date.now()}-${extra}-${rand}`;
};
