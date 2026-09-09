import React from 'react';
import { IStatusVariant } from '@webstack/components/UiBadge/UiBadge';
import type { HostRow } from './types';
import type { NetworkConn } from './deviceVpn';
import { clampPct } from './systemUtils';

// Shared cell/format helpers for the fleet device rows (table + tree).

export const lanIpOf = (h: HostRow): string =>
    h?.extra?.lan_ip || h.ssh_ip || h.host_lan_ip || 'na';

export const wanIpOf = (h: HostRow): string =>
    h?.extra?.wan_ip || 'na';

export const networkIcon = (n: NetworkConn): string => {
    if (n.name === 'Cloudflare') return 'fa-cloud';
    return n.state === 'on' ? 'fa-shield-halved' : 'fa-shield';
};

export const networkVariant = (state: NetworkConn['state']): IStatusVariant =>
    state === 'on' ? 'ok' : state === 'off' ? 'bad' : 'unknown';

export const formatGpu = (h: HostRow): React.ReactNode => {
    const name = h.extra?.gpu_name;
    const totalGb = h.gpu_mem_total_mb != null ? `${(h.gpu_mem_total_mb / 1024).toFixed(1)} GB` : null;
    const util = h.gpu_util_pct != null ? `${clampPct(h.gpu_util_pct).toFixed(1)}%` : null;

    if (!name && !totalGb && !util) return <span className="device-gpu device-gpu--none">n/a</span>;

    return (
        <div className="device-gpu">
            {name && <div className="device-gpu__name">{name}</div>}
            <div className="device-gpu__stats">{[util, totalGb].filter(Boolean).join(' · ')}</div>
        </div>
    );
};
