import type { MutableRefObject } from 'react';
import type { GpsSource, GpsState, GpsSourceKind } from '@Canopy/models/overlay/gpsSource';
import type { GuardianFix } from '~/src/modules/apps/Guardian/hooks/tracker/types';

type GpsSample = { lat: number; lon: number; timestamp: number };
type GpsMap = {
  map: Map<string, string>;
  get: (vehicleNumber?: string | number) => string | undefined;
};

export type ResolveCtx = {
  gps: GpsMap;
  lastGpsSamplesRef: MutableRefObject<Map<string, GpsSample>>;
  guardianFix?: GuardianFix | null;
};

export type ResolveResult = {
  lat: number | null;
  lng: number | null;
  gpsState: GpsState;
};

const STALE_SEC = 60;

export const resolveGpsSource = (
  source: GpsSource | null | undefined,
  ctx: ResolveCtx,
): ResolveResult => {
  if (!source) {
    return { lat: null, lng: null, gpsState: { kind: 'none' } };
  }

  switch (source.kind) {
    case 'manual': {
      const { lat, lng } = source;
      return {
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        gpsState: { kind: 'none' },
      };
    }

    case 'team': {
      const { team_number } = source;
      const label = `#${team_number}`;
      const coord = ctx.gps.get(team_number);
      if (!coord) {
        return { lat: null, lng: null, gpsState: { kind: 'pending', sourceKind: 'team', label } };
      }
      const [latS, lonS] = String(coord).split(',').map((s) => s.trim());
      const lat = Number(latS);
      const lng = Number(lonS);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { lat: null, lng: null, gpsState: { kind: 'error', sourceKind: 'team', label } };
      }

      const prev = ctx.lastGpsSamplesRef.current.get(team_number);
      const now = Date.now();
      const moved = !prev || prev.lat !== lat || prev.lon !== lng;
      const stampTs = moved ? now : prev!.timestamp;
      if (moved) {
        ctx.lastGpsSamplesRef.current.set(team_number, { lat, lon: lng, timestamp: now });
      }
      const ageSec = Math.max(0, Math.round((now - stampTs) / 1000));

      return {
        lat,
        lng,
        gpsState: ageSec > STALE_SEC
          ? { kind: 'stale', sourceKind: 'team' as GpsSourceKind, label, ageSec }
          : { kind: 'live' },
      };
    }

    case 'guardian': {
      const { user_id } = source;
      const label = user_id;
      if (!ctx.guardianFix) {
        return { lat: null, lng: null, gpsState: { kind: 'pending', sourceKind: 'guardian', label } };
      }
      const { latitude: lat, longitude: lng, timestamp: ts } = ctx.guardianFix;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { lat: null, lng: null, gpsState: { kind: 'error', sourceKind: 'guardian', label } };
      }
      const now = Date.now();
      const ageSec = ts ? Math.max(0, Math.round((now - ts) / 1000)) : 0;
      return {
        lat,
        lng,
        gpsState: ageSec > STALE_SEC
          ? { kind: 'stale', sourceKind: 'guardian' as GpsSourceKind, label, ageSec }
          : { kind: 'live' },
      };
    }
  }
};
