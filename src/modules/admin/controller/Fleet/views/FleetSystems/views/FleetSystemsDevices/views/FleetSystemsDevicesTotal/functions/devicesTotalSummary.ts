// Relative Path: ./devicesTotalSummary.ts
// Aggregates the fleet hosts list into the fleet-wide counters
// FleetSystemsDevicesTotal renders (device online/offline split, role split,
// distinct overlay networks in use, and average resource load).
import type { HostRow } from '../../../../../helpers/types';
import { buildTailnetIndex, resolveDeviceNetworks } from '../../../../../helpers/deviceVpn';
import { humanBytes, STALE_THRESHOLD_MS } from '../../../../../helpers/systemUtils';

export type DevicesTotalSummary = {
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
  orchestratorCount: number;
  runnerCount: number;
  networkCount: number;        // distinct overlay networks in use fleet-wide (e.g. Tailscale, Cloudflare)
  networkOnlineCount: number;  // live "on" overlay connections across all devices
  avgCpuPct: number | null;
  avgMemPct: number | null;
  totalMemoryBytes: number;
  totalStorageBytes: number;
  totalMemoryHuman: string;
  totalStorageHuman: string;
};

const isHostOnline = (host: HostRow): boolean =>
  !!host.ts && Date.now() - new Date(host.ts).getTime() < STALE_THRESHOLD_MS;

const average = (values: number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

// system_metrics_v/system_metrics_latest expose cpu_pct/mem_pct/*_bytes as
// Postgres NUMERIC columns, which the pg driver returns as strings — sum
// them as raw values and every downstream average silently becomes NaN.
const toFiniteNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const summarizeDevicesTotal = (hosts?: HostRow[]): DevicesTotalSummary => {
  const list = hosts ?? [];
  const tailnetIndex = buildTailnetIndex(list);

  let onlineCount = 0;
  let orchestratorCount = 0;
  let networkOnlineCount = 0;
  let totalMemoryBytes = 0;
  let totalStorageBytes = 0;
  const cpuValues: number[] = [];
  const memValues: number[] = [];
  const networkNames = new Set<string>();

  for (const host of list) {
    if (isHostOnline(host)) onlineCount += 1;
    if (host.role !== 'runner') orchestratorCount += 1;

    const cpuPct = toFiniteNumber(host.cpu_pct);
    if (cpuPct != null) cpuValues.push(cpuPct);

    const memPct = toFiniteNumber(host.mem_pct);
    if (memPct != null) memValues.push(memPct);

    totalMemoryBytes += toFiniteNumber(host.mem_total_bytes) ?? 0;
    totalStorageBytes += toFiniteNumber(host.disk_root_total_bytes) ?? 0;

    for (const network of resolveDeviceNetworks(host, tailnetIndex)) {
      networkNames.add(network.name);
      if (network.state === 'on') networkOnlineCount += 1;
    }
  }

  return {
    deviceCount: list.length,
    onlineCount,
    offlineCount: list.length - onlineCount,
    orchestratorCount,
    runnerCount: list.length - orchestratorCount,
    networkCount: networkNames.size,
    networkOnlineCount,
    avgCpuPct: average(cpuValues),
    avgMemPct: average(memValues),
    totalMemoryBytes,
    totalStorageBytes,
    totalMemoryHuman: humanBytes(totalMemoryBytes),
    totalStorageHuman: humanBytes(totalStorageBytes),
  };
};
