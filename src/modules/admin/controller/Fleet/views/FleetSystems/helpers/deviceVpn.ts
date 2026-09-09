// Per-device VPN membership derivation.
//
// The metrics agent only sees its OWN Tailscale state, and only when it can
// reach the host's tailscaled socket — which the containerized macOS agents
// cannot. As a result those hosts report `extra.tailscale = null` even though
// they are on the tailnet. The hosts that CAN read Tailscale, however, report a
// `peers` list covering the whole fleet, and each peer's dns_name first-label
// matches the device host_key (e.g. `xi1-mbp-2.tailXXXX.ts.net` -> `xi1-mbp-2`).
//
// So we build a fleet-wide tailnet index from every host's self + peers, then
// resolve each device's membership: prefer its own `self`, else cross-reference.
import type { HostRow } from './types';

export type DeviceVpn = {
  name: string;            // e.g. 'Tailscale'
  online: boolean;         // reachable on the VPN right now
  ip?: string;             // VPN-assigned address
  via?: 'self' | 'peer';   // how membership was determined
};

type TailnetEntry = { online: boolean; ip?: string };
export type TailnetIndex = Map<string, TailnetEntry>;

const norm = (s?: string | null) => (s || '').trim().toLowerCase();
const dnsLabel = (dns?: string | null) => norm(dns).split('.')[0];

const selfOnline = (ts: any) =>
  !!ts?.self?.online && (ts?.backend_state === 'Running' || ts?.backend_state == null);

/** Index every tailnet node seen across the fleet by dns-label, hostname, and ip. */
export function buildTailnetIndex(hosts?: HostRow[]): TailnetIndex {
  const idx: TailnetIndex = new Map();
  const add = (key: string, e: TailnetEntry) => {
    if (!key) return;
    const prev = idx.get(key);
    idx.set(key, prev ? { online: prev.online || e.online, ip: prev.ip || e.ip } : { ...e });
  };

  for (const h of hosts || []) {
    const ts = (h?.extra as any)?.tailscale;
    if (!ts) continue;

    if (ts.self) {
      const e: TailnetEntry = { online: selfOnline(ts), ip: ts.self.ip || undefined };
      add(dnsLabel(ts.self.dns_name), e);
      add(norm(ts.self.hostname), e);
      if (ts.self.ip) add(norm(ts.self.ip), e);
    }
    for (const p of ts.peers || []) {
      const e: TailnetEntry = { online: !!p.online, ip: p.ip || undefined };
      add(dnsLabel(p.dns_name), e);
      add(norm(p.hostname), e);
      if (p.ip) add(norm(p.ip), e);
    }
  }
  return idx;
}

/** VPNs a device is on. Today only Tailscale is derivable from telemetry. */
export function resolveDeviceVpns(host: HostRow, index: TailnetIndex): DeviceVpn[] {
  const vpns: DeviceVpn[] = [];
  const ts = (host?.extra as any)?.tailscale;

  if (ts?.self) {
    vpns.push({ name: 'Tailscale', online: selfOnline(ts), ip: ts.self.ip || undefined, via: 'self' });
  } else {
    // Cross-reference the fleet tailnet by the device's stable identifiers.
    const candidates = [host.host_key, host.display_name, (host as any).ssh_wan_ip]
      .map(norm)
      .filter(Boolean);
    for (const c of candidates) {
      const hit = index.get(c);
      if (hit) {
        vpns.push({ name: 'Tailscale', online: hit.online, ip: hit.ip, via: 'peer' });
        break;
      }
    }
  }

  return vpns;
}

/** Grouping label for the device tree: the VPN(s) a device belongs to. */
export function vpnGroupLabel(vpns: DeviceVpn[]): string {
  if (!vpns.length) return 'No VPN';
  return vpns.map(v => v.name).join(' + ');
}

// ── networks ──────────────────────────────────────────────────────────────
// A "network" is any overlay/remote-access network a device is reachable on,
// each with its address. LAN/WAN are shown in their own columns; this covers
// the overlays: Tailscale (mesh VPN) and Cloudflare (tunnel).

export type NetworkConn = {
  name: string;                 // 'Tailscale' | 'Cloudflare'
  address?: string;             // IP (Tailscale) or hostname (Cloudflare)
  state: 'on' | 'off' | 'na';   // on/off for live-known, na for configured-only
};

/** All overlay networks a device is connected to, with addresses. */
export function resolveDeviceNetworks(host: HostRow, index: TailnetIndex): NetworkConn[] {
  const nets: NetworkConn[] = [];

  // Tailscale: live membership (own self or cross-referenced peer), with the
  // config tailscale_ip as an address fallback.
  const vpns = resolveDeviceVpns(host, index);
  const tailIp = host.tailscale_ip;
  if (vpns.length) {
    nets.push({ name: 'Tailscale', address: vpns[0].ip || tailIp || undefined, state: vpns[0].online ? 'on' : 'off' });
  } else if (tailIp) {
    nets.push({ name: 'Tailscale', address: tailIp, state: 'na' });
  }

  // Cloudflare: configured tunnel hostname (live per-device reachability isn't
  // exposed, so state is 'na').
  if (host.ssh_hostname) {
    nets.push({ name: 'Cloudflare', address: host.ssh_hostname, state: 'na' });
  }

  return nets;
}

/** Network names for tree grouping; a device groups under EACH network it's on. */
export function networkNames(nets: NetworkConn[]): string[] {
  return nets.map(n => n.name);
}
