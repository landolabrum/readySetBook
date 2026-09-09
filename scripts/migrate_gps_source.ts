#!/usr/bin/env node
// Run with: node --experimental-strip-types webapp/scripts/migrate_gps_source.ts [--dry] [--api-base <url>]
//
// Reads all livestream_event_overlay aggregate rows, finds hud/weather/map overlays
// where data.gps_source is null but a legacy GPS field (team_number, userId, lat/lng)
// is set, and backfills data.gps_source.  Idempotent — running twice is safe.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// .env loader (simple key=value, no interpolation needed)
// ---------------------------------------------------------------------------
function loadEnv(envPath: string): Record<string, string> {
  try {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    const out: Record<string, string> = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const env = loadEnv(envPath);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const apiBaseIdx = args.indexOf('--api-base');
const API_BASE = (apiBaseIdx >= 0 ? args[apiBaseIdx + 1] : null)
  ?? env.NEXT_PUBLIC_API_BASE
  ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Inline migrateLegacyToGpsSource (mirrors models/overlay/gpsSource.ts)
// ---------------------------------------------------------------------------
type GpsSource =
  | { kind: 'manual'; lat: number; lng: number; address?: any }
  | { kind: 'team'; team_number: string }
  | { kind: 'guardian'; user_id: string; device_id?: string | null };

function migrateLegacyToGpsSource(data: any): GpsSource | null {
  const teamNum = data?.team_number != null ? String(data.team_number).trim() : '';
  if (teamNum) return { kind: 'team', team_number: teamNum };

  const rawUserId = data?.userId ?? data?.user_id;
  const userIdStr = rawUserId != null ? String(rawUserId).trim() : '';
  if (userIdStr) return { kind: 'guardian', user_id: userIdStr };

  const lat = Number(data?.lat);
  const lng = Number(data?.lng ?? data?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    return { kind: 'manual', lat, lng, address: data?.address ?? null };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Minimal API client
// ---------------------------------------------------------------------------
async function apiPost(path: string, body: unknown): Promise<any> {
  const url = `${API_BASE}/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${url} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function dbSelect(tableName: string, where?: Record<string, any>): Promise<any[]> {
  const payload: any = { tableName, rows: [], cells: [] };
  if (where) payload.where = { exact: where };
  const res = await apiPost('db/select', payload);
  return Array.isArray(res?.data) ? res.data : [];
}

async function dbUpdate(tableName: string, set: Record<string, any>, where: Record<string, any>): Promise<void> {
  await apiPost('db/update', { tableName, set, where });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n🔍 migrate_gps_source  [${DRY ? 'DRY RUN' : 'LIVE'}]  api=${API_BASE}\n`);

  const events: any[] = await dbSelect('livestream_event');
  if (!events.length) {
    console.log('No events found.');
    return;
  }
  console.log(`Found ${events.length} event(s).\n`);

  let totalOverlays = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalAlready = 0;

  for (const event of events) {
    const eventId = event.id ?? event.event_id;
    const eventName = event.name ?? event.title ?? String(eventId);
    const numericEventId = Number(eventId);
    const eventIdForWhere = Number.isFinite(numericEventId) ? numericEventId : eventId;

    const rows: any[] = await dbSelect('livestream_event_overlay', { event_id: eventIdForWhere });
    if (!rows.length) continue;

    // Aggregate mode: single row, state column holds the overlay array
    const row = rows[0];
    let state: any[] | null = null;
    if (Array.isArray(row?.state)) {
      state = row.state;
    } else if (typeof row?.state === 'string') {
      try { const j = JSON.parse(row.state); if (Array.isArray(j)) state = j; } catch { /* ignore */ }
    }

    if (!state || !state.length) continue;

    const GPS_TYPES = new Set(['hud', 'weather', 'map']);
    let changed = false;
    const diffs: string[] = [];

    const updated = state.map((ov: any) => {
      const type = String(ov?.type ?? '').toLowerCase();
      if (!GPS_TYPES.has(type)) return ov;
      totalOverlays++;

      const data = ov?.data ?? {};

      if (data?.gps_source != null) {
        totalAlready++;
        return ov;
      }

      const migrated = migrateLegacyToGpsSource(data);
      if (!migrated) {
        totalSkipped++;
        return ov;
      }

      totalMigrated++;
      changed = true;
      const id = ov?.id ?? `(${type})`;
      diffs.push(`  [${id}] ${type}: null → ${JSON.stringify(migrated)}`);
      return { ...ov, data: { ...data, gps_source: migrated } };
    });

    if (!changed) continue;

    console.log(`Event ${eventId} "${eventName}":`);
    for (const d of diffs) console.log(d);

    if (!DRY) {
      await dbUpdate(
        'livestream_event_overlay',
        { state: updated },
        { event_id: eventIdForWhere },
      );
      console.log(`  ✓ saved\n`);
    } else {
      console.log(`  (dry — not saved)\n`);
    }
  }

  console.log('─'.repeat(50));
  console.log(`GPS overlay rows seen : ${totalOverlays}`);
  console.log(`Already have gps_source: ${totalAlready}`);
  console.log(`Migrated              : ${totalMigrated}`);
  console.log(`No legacy data (skip) : ${totalSkipped}`);
  if (DRY && totalMigrated > 0) {
    console.log('\nRe-run without --dry to apply changes.');
  } else if (!DRY && totalMigrated === 0) {
    console.log('\nNothing to migrate — already up to date.');
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
