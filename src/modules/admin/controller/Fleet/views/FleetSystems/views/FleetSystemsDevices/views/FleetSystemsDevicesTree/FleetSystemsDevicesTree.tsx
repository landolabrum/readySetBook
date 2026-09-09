// Relative Path: ./FleetSystemsDevicesTree.tsx
import React, { useMemo, useState } from 'react';
import styles from './FleetSystemsDevicesTree.scss';
import ThreeTree from '@webstack/components/ThreeComponents/ThreeTree/controller/ThreeTree';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';
import type { HostRow } from '../../../../helpers/types';
import { buildTailnetIndex, resolveDeviceNetworks, networkNames, type TailnetIndex } from '../../../../helpers/deviceVpn';
import { platformLabel, platformIconSvg } from '../../../../helpers/platform';
import { STALE_THRESHOLD_MS } from '../../../../helpers/systemUtils';
type GroupKey = 'subnet' | 'platform' | 'network' | 'status';

type Props = {
    view: string;
    hosts: HostRow[];
    onSelectHost?: (hostKey: string) => void;
};

// const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const lanIpOf = (h: HostRow) =>
    h?.extra?.lan_ip || h.ssh_ip || h.host_lan_ip || 'na';

const subnetOf = (ip: string) => {
    const parts = String(ip || '').split('.');
    if (parts.length === 4 && parts.every(p => p !== '')) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
    return 'unknown';
};

const statusOf = (h: HostRow) => {
    const age = h.ts ? Date.now() - new Date(h.ts).getTime() : Infinity;
    return age < STALE_THRESHOLD_MS ? 'online' : 'stale';
};

const pct = (n?: number | null) =>
    n != null && Number.isFinite(Number(n)) ? `${Number(n).toFixed(1)}%` : '—';

const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
    return `${Math.round(diff / 86_400_000)}d ago`;
};

// `of` returns one group (most keys) or several (network: a device groups under
// every network it's connected to).
const GROUPERS: { key: GroupKey; label: string; of: (h: HostRow, index: TailnetIndex) => string | string[] }[] = [
    { key: 'subnet', label: 'Subnet', of: h => subnetOf(lanIpOf(h)) },
    { key: 'platform', label: 'Platform', of: h => platformLabel(h) },
    { key: 'network', label: 'Network', of: (h, index) => networkNames(resolveDeviceNetworks(h, index)) },
    { key: 'status', label: 'Status', of: h => statusOf(h) },
];

const FleetSystemsDevicesTree: React.FC<Props> = ({ view, hosts, onSelectHost }) => {
    const [groupKey, setGroupKey] = useState<GroupKey>('subnet');

    const { data, nameToHost } = useMemo(() => {
        const grouper = GROUPERS.find(g => g.key === groupKey) || GROUPERS[0];
        const tailnet = buildTailnetIndex(hosts);
        const groups: Record<string, Record<string, any>> = {};
        const nameToHost: Record<string, string> = {};

        for (const h of hosts || []) {
            const raw = grouper.of(h, tailnet);
            const groupList = Array.isArray(raw) ? (raw.length ? raw : ['none']) : [raw || 'unknown'];
            const name = h.display_name || h.host_key;
            nameToHost[name] = h.host_key;

            const nets = resolveDeviceNetworks(h, tailnet);
            const leaf = {
                // Leading platform icon (inline SVG) rendered before the device label;
                // `__`-prefixed keys are node metadata, not rendered as child rows.
                __icon: platformIconSvg(h),
                lan: lanIpOf(h),
                wan: h?.extra?.wan_ip || 'na',
                tailscale: nets.find(n => n.name === 'Tailscale')?.address || '—',
                cloudflare: nets.find(n => n.name === 'Cloudflare')?.address || '—',
                cpu: pct(h.cpu_pct),
                memory: pct(h.mem_pct),
                last_seen: h.ts ? timeAgo(h.ts) : 'never',
            };

            for (const group of groupList) {
                if (!groups[group]) groups[group] = {};
                groups[group][name] = leaf;
            }
        }

        return { data: groups, nameToHost };
    }, [hosts, groupKey]);

    const btns = useMemo(
        () => GROUPERS.map(g => ({ name: g.key, label: g.label, checked: g.key === groupKey })),
        [groupKey]
    );

    const handleGroupSelect = (e: any) => {
        const name: GroupKey | undefined = e?.detail?.name ?? e?.target?.name;
        if (name) setGroupKey(name);
    };

    const handleNodeClick = (node: any) => {
        const hostKey = node?.name && nameToHost[node.name];
        if (hostKey) onSelectHost?.(hostKey);
    };

    return (
        <>
            <style jsx>{styles}</style>
            <div className="fleet-systems-devices-tree">
                <div className="fleet-systems-devices-tree__controls">
                    <UiButtonGroup

                        direction='ltr'

                        variant="bundle"

                        label="Group by" btns={btns} onSelect={handleGroupSelect} />
                </div>
                <div className="fleet-systems-devices-tree__body">


                    <ThreeTree title="devices" data={data} variant={view} onClick={handleNodeClick} />
                </div>
            </div>
        </>
    );
};

export default FleetSystemsDevicesTree;