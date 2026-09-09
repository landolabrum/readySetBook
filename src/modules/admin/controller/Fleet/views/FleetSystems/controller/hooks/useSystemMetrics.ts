import { useCallback, useRef, useState } from 'react';
import type IDataBaseService from '~/src/core/services/DataBaseService/IDataBaseService';
import type { HostRow, MetricRow, RangeKey } from '../../helpers/types';
import { rangeToMs } from '../../helpers/systemUtils';
import { deriveSystemData } from '../../helpers/deriveSystemData';

const TABLE_METRICS = 'system_metrics_v';
const TABLE_LATEST = 'system_metrics_latest';
const TABLE_HOSTS = 'system_hosts';

/** Host list + per-host metrics timeline (reads the metrics views over
 *  db/select). Presentation-agnostic slice of useFleetSystemsNetwork. */
export default function useSystemMetrics(db: IDataBaseService, initialRange: RangeKey) {
    const [hosts, setHosts] = useState<HostRow[]>([]);
    const [selectedHostKey, setSelectedHostKey] = useState<string>('');
    const [timeline, setTimeline] = useState<MetricRow[]>([]);
    const [systemData, setSystemData] = useState<any>();
    const [range, setRange] = useState<RangeKey>(initialRange);
    const [loading, setLoading] = useState(false);

    const timelineRequestIdRef = useRef(0);

    const fetchHosts = useCallback(async () => {
        try {
            const res = await db.selectData({ tableName: TABLE_LATEST });
            const rows = (res?.data as HostRow[]) ?? [];

            // Enrich each metrics row with the device's network config (Cloudflare
            // tunnel hostname + Tailscale IP) so the device views can show every
            // network a host is reachable on. Best-effort: config-only columns,
            // never the secrets column. NOTE: config `ssh_wan_ip` is the Tailscale
            // 100.x address (not WAN) — kept under `tailscale_ip` to avoid clobbering
            // the WAN field.
            let merged = rows;
            try {
                const cfgRes = await db.selectData({
                    tableName: TABLE_HOSTS,
                    rows: [
                        { name: 'host_key' },
                        { name: 'ssh_hostname' },
                        { name: 'ssh_wan_ip' },
                        { name: 'cloudflared' },
                        { name: 'role' },
                        { name: 'device_class' },
                        { name: 'latitude' },
                        { name: 'longitude' },
                        { name: 'geo_source' },
                        { name: 'owner_user_id' },
                    ],
                });
                const cfgByKey = new Map(
                    ((cfgRes?.data as any[]) ?? []).map((c) => [c.host_key, c]),
                );
                merged = rows.map((r) => {
                    const c = cfgByKey.get(r.host_key);
                    return c
                        ? {
                            ...r,
                            ssh_hostname: c.ssh_hostname,
                            tailscale_ip: c.ssh_wan_ip,
                            cloudflared: c.cloudflared,
                            role: c.role,
                            device_class: c.device_class,
                            latitude: c.latitude,
                            longitude: c.longitude,
                            geo_source: c.geo_source,
                            owner_user_id: c.owner_user_id,
                        }
                        : r;
                });
            } catch (cfgErr) {
                console.error('[useSystemMetrics] host config enrich error:', cfgErr);
            }

            setHosts(merged);

            setSelectedHostKey(prev => {
                if (prev || !merged.length) return prev;
                const defaultHost = merged.find((h) => h.host_key === 'mindburn-host') || merged[0];
                return defaultHost.host_key;
            });
        } catch (err) {
            console.error('[useSystemMetrics] fetchHosts error:', err);
        }
    }, [db]);

    const fetchTimeline = useCallback(async (hostKey: string, r: RangeKey = range) => {
        if (!hostKey) return;

        const requestId = ++timelineRequestIdRef.current;
        setLoading(true);

        try {
            const sinceIso = new Date(Date.now() - rangeToMs(r)).toISOString();
            const timelineRes = await db.selectData({
                tableName: TABLE_METRICS,
                rows: [
                    { name: 'ts' },
                    { name: 'cpu_pct' },
                    { name: 'mem_pct' },
                    { name: 'gpu_util_pct' },
                    { name: 'gpu_mem_used_mb' },
                    { name: 'gpu_mem_total_mb' },
                    { name: 'host_key' },
                    { name: 'display_name' },
                    { name: 'disk_root_used_bytes' },
                    { name: 'disk_root_total_bytes' },
                    { name: 'net_rx_bytes' },
                    { name: 'net_tx_bytes' },
                    { name: 'temps_c' },
                    { name: 'extra' },
                ],
                where: { exact: { host_key: hostKey } },
            });

            if (requestId !== timelineRequestIdRef.current) return;

            const rawRows = (timelineRes?.data as MetricRow[]) ?? [];
            let rows = rawRows
                .filter((rw) => rw?.ts && new Date(rw.ts).getTime() >= new Date(sinceIso).getTime())
                .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

            if (rows.length === 0 && rawRows.length > 0) {
                rows = rawRows
                    .filter((rw) => rw?.ts)
                    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
                if (rows.length > 200) rows = rows.slice(rows.length - 200);
            }

            setTimeline(rows);
            const latest = rows.length ? rows[rows.length - 1] : undefined;
            setSystemData(latest ? deriveSystemData(latest) : { error: 'no metrics yet' });
        } catch (err: any) {
            if (requestId === timelineRequestIdRef.current) {
                setSystemData({ error: err?.message || 'fetch failed' });
                setTimeline([]);
            }
        } finally {
            if (requestId === timelineRequestIdRef.current) {
                setLoading(false);
            }
        }
    }, [db, range]);

    const selectHost = useCallback((hostKey: string) => {
        setSelectedHostKey(hostKey);
    }, []);

    return {
        hosts, selectedHostKey, timeline, systemData, range, loading,
        setRange, selectHost, fetchHosts, fetchTimeline,
    };
}
