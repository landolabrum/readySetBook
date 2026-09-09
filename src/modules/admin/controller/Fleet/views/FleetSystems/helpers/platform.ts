// Platform detection for fleet devices.
//
// The naive approach (substring-match the display_name) is wrong in two ways:
//  1. It hard-codes "host" → Ubuntu, but the orchestrator now runs Debian.
//  2. It can't tell distros apart, and a stray substring (e.g. "pi") misfires.
//
// Equally, we can't just trust `extra.os_info.distro`: Mac and Pi devices run
// the metrics agent inside a Linux container / Colima VM, so their os_info
// reports the *container's* distro (e.g. "debian") rather than the real
// hardware. So hardware class (mac / raspberry-pi) is taken from the canonical
// fleet `host_key` naming, and the specific Linux distro icon is taken from
// os_info only once we've established the device really is a Linux server.

import type { MetricRow } from './types';
import { systemIcons } from '@webstack/components/UiIcon/icons/categories/system_icons';

export type PlatformId =
  | 'mac'
  | 'raspberry-pi'
  | 'debian'
  | 'ubuntu'
  | 'windows'
  | 'linux'
  | 'unknown';

export type PlatformInfo = { id: PlatformId; label: string; icon: string };

const ICON: Record<PlatformId, string> = {
  mac: 'fa-apple',
  'raspberry-pi': 'fa-raspberry-pi',
  debian: 'fa-debian',
  ubuntu: 'fa-ubuntu',
  windows: 'fa-windows',
  linux: 'fa-debian', // no generic linux brand in the set; debian is the fleet default
  unknown: 'fa-server',
};

const LABEL: Record<PlatformId, string> = {
  mac: 'Mac',
  'raspberry-pi': 'Raspberry Pi',
  debian: 'Debian',
  ubuntu: 'Ubuntu',
  windows: 'Windows',
  linux: 'Linux',
  unknown: 'Other',
};

type HostLike = Pick<MetricRow, 'host_key' | 'display_name' | 'extra' | 'device_class'>;

// Fleet host_keys are hyphen/underscore-delimited (mb1-orch-1, xi1-mbp-2,
// mb1-pi5-1, xi1-mm-1). Match whole segments — `startsWith` covers numbered
// variants like pi5/pi4 — so we never trip on a substring inside a longer word.
const hasSeg = (key: string, ...segs: string[]) => {
  const parts = key.split(/[\s\-_]+/).filter(Boolean);
  return parts.some(p => segs.some(s => p === s || p.startsWith(s)));
};

export const detectPlatform = (h: HostLike): PlatformInfo => {
  const key = (h.host_key || h.display_name || '').toLowerCase();
  const os = (h.extra?.os_info || {}) as Record<string, string>;
  const distro = (os.distro || '').toLowerCase();
  const platform = (os.platform || '').toLowerCase();
  const name = (os.name || '').toLowerCase();

  let id: PlatformId = 'unknown';

  // 0) Explicit device_class from the host row is authoritative — names must
  //    not dictate platform. mb1-mbp-2 is a MacBook Pro BY NAME but runs
  //    Debian natively (device_class=x86): the 'mbp' segment heuristic below
  //    would mis-classify it as a colima Mac. For x86 the specific distro
  //    icon still comes from os_info (debian/ubuntu), defaulting to debian.
  const cls = (h.device_class || '').toLowerCase();
  if (cls === 'mac') {
    id = 'mac';
  }
  // Depricated 9/10/26 just use os
  //  else if (cls === 'pi5') {
  //   id = 'raspberry-pi';
  // }
   else if (cls === 'x86') {
    id = distro.includes('ubuntu') || name.includes('ubuntu') ? 'ubuntu' : 'debian';
  }
  if (id !== 'unknown') return { id, label: LABEL[id], icon: ICON[id] };

  // 1) Hardware class next (host_key naming is the trustworthy signal here —
  //    see file header on why os_info can't be trusted for Mac/Pi).
  if (
    platform === 'darwin' ||
    name.includes('macos') ||
    name.includes('mac os') ||
    hasSeg(key, 'mbp', 'mm', 'mac', 'macbook', 'imac', 'macmini')
  ) {
    id = 'mac';
  }
    // Depricated 9/10/26 just use os
  //  else if (hasSeg(key, 'pi', 'rpi') || name.includes('raspberry')) {
    // id = 'raspberry-pi';
  // }
   else if (platform === 'windows' || name.includes('windows')) {
    id = 'windows';
    // 2) Real Linux server — pick the specific distro from os_info, then
    //    fall back to legacy host_key hints for the orchestrator/host.
  } else if (distro.includes('debian') || name.includes('debian')) {
    id = 'debian';
  } else if (distro.includes('ubuntu') || name.includes('ubuntu')) {
    id = 'ubuntu';
  } else if (platform === 'linux' || distro || name) {
    id = 'linux';
  } else if (hasSeg(key, 'orch', 'host', 'server')) {
    id = 'debian';
  }

  return { id, label: LABEL[id], icon: ICON[id] };
};

export const platformIcon = (h: HostLike): string => detectPlatform(h).icon;
export const platformLabel = (h: HostLike): string => detectPlatform(h).label;

// Inline SVG markup for a device's platform icon, built from the same icon
// registry UiIcon uses. Useful where a React component can't be rendered (e.g.
// the d3/SVG ThreeTree, which injects node labels via .html()). Returns '' when
// the icon isn't a vector in the set (e.g. the 'unknown' fallback).
export const platformIconSvg = (h: HostLike, size = 22): string => {
  const def = (systemIcons as Record<string, { width: number; height: number; path: string }>)[
    platformIcon(h)
  ];
  if (!def) return '';
  return (
    `<svg viewBox="0 0 ${def.width} ${def.height}" width="${size}" height="${size}" ` +
    `aria-hidden="true" focusable="false" ` +
    `style="vertical-align:-2px;margin-right:5px;fill:currentColor;flex:0 0 auto">` +
    `<path d="${def.path}"/></svg>`
  );
};
