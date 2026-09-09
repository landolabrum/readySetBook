import type { MetricRow } from './types';
import { clampPct, humanBytes, pickTemp } from './systemUtils';

/** Derive the system-data summary object from the latest metric row */
export function deriveSystemData(latest: MetricRow | undefined) {
    if (!latest) return undefined;

    const cpuInfo = `CPU ${Number(latest.cpu_pct ?? 0).toFixed(1)}%`;
    const gpuInfo =
        typeof latest.gpu_util_pct === 'number'
            ? `GPU ${latest.gpu_util_pct.toFixed(1)}%` +
            (latest.gpu_mem_total_mb ? ` • ${latest.gpu_mem_used_mb ?? 0}/${latest.gpu_mem_total_mb}MB` : '')
            : 'GPU n/a';

    const temps = (latest.temps_c ?? {}) as Record<string, number>;
    const cpuCandidates = ['coretemp', 'package-0', 'cpu', 'acpitz', 'coretemp-isa-0000'];
    const gpuCandidates = ['gpu', 'nvidia', 'amdgpu', 'nouveau', 'radeon', 'gpu_core'];
    const cpuTempData = pickTemp(temps, cpuCandidates);
    const gpuTempData = pickTemp(temps, gpuCandidates);

    const diskUsed = Number(latest.disk_root_used_bytes ?? 0);
    const diskTotal = Number(latest.disk_root_total_bytes ?? 0);
    const diskPct = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;
    const netRxBytes = Number(latest.net_rx_bytes ?? 0);
    const netTxBytes = Number(latest.net_tx_bytes ?? 0);
    const peersConnected = Number((latest.extra as any)?.peers_connected ?? 0);
    const networkInterfaces = ((latest.extra as any)?.network_interfaces || {}) as Record<string, string[]>;
    const lanIp = ((latest.extra as any)?.lan_ip as string) || null;
    const wanIp = ((latest.extra as any)?.wan_ip as string) || null;
    const macAddress = ((latest.extra as any)?.mac_address as string) || null;
    const dockerContainers = ((latest.extra as any)?.docker_containers as any[]) || [];
    const dockerState = ((latest.extra as any)?.docker_state as string) || null;
    const dockerError = ((latest.extra as any)?.docker_error as string) || null;
    const dockerLastCheckedTs = ((latest.extra as any)?.docker_last_checked_ts as string) || null;
    const osInfo = ((latest.extra as any)?.os_info as Record<string, string> | null) ?? null;
    const tailscale = ((latest.extra as any)?.tailscale as any) ?? null;
    const victron = ((latest.extra as any)?.victron as any) ?? null;
    const litime = ((latest.extra as any)?.litime as any) ?? null;

    // Temperature coloring: treat °C as % of 100 (0–100°C scale, reasonable for both CPU/GPU)
    const tempColorPct = (val?: number) => (typeof val === 'number' ? clampPct(val) : undefined);

    return {
        timestamp: latest.ts,
        cpu_info: cpuInfo,
        gpu_info: gpuInfo,
        // Structured numeric fields for cards
        cpu_pct: Number(latest.cpu_pct ?? 0),
        gpu_util_pct: typeof latest.gpu_util_pct === 'number' ? latest.gpu_util_pct : null,
        gpu_mem_used_mb: latest.gpu_mem_used_mb ?? null,
        gpu_mem_total_mb: latest.gpu_mem_total_mb ?? null,
        cpu_temp: cpuTempData?.value,
        cpu_temp_name: cpuTempData?.name,
        cpu_temp_color_pct: tempColorPct(cpuTempData?.value),
        gpu_temp: gpuTempData?.value,
        gpu_temp_name: gpuTempData?.name,
        gpu_temp_color_pct: tempColorPct(gpuTempData?.value),
        memory_percentage: clampPct(latest.mem_pct),
        disks: [{
            device: '/', mountpoint: '/', model: 'rootfs', serial: undefined,
            fstype: 'ext4', opts: '',
            total_human: humanBytes(diskTotal), used_human: humanBytes(diskUsed),
            percent_used: diskPct,
        }],
        peers_connected: peersConnected,
        net_rx_bytes: netRxBytes,
        net_tx_bytes: netTxBytes,
        net_rx_human: humanBytes(netRxBytes),
        net_tx_human: humanBytes(netTxBytes),
        network_interfaces: networkInterfaces,
        lan_ip: lanIp,
        wan_ip: wanIp,
        mac_address: macAddress,
        docker_containers: dockerContainers,
        docker_state: dockerState,
        docker_error: dockerError,
        docker_last_checked_ts: dockerLastCheckedTs,
        os_info: osInfo,
        tailscale,
        victron,
        litime,
    };
}
