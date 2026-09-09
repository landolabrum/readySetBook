import { useEffect, useMemo, useRef } from 'react';
import { getService } from '@webstack/common';
import IDataBaseService from '~/src/core/services/DataBaseService/IDataBaseService';
import IAdminService from '~/src/core/services/AdminService/IAdminService';
import type { RangeKey } from '../../helpers/types';
import useSystemMetrics from './useSystemMetrics';
import useDockerOps from './useDockerOps';
import useDeviceConfigOps from './useDeviceConfigOps';
import useFleetOps from './useFleetOps';
import useBluetoothOps from './useBluetoothOps';

// Re-exported so existing consumers keep importing from this module.
export type { UpdateScope, UpdateLogEntry } from './useDockerOps';
export type { GpioRelay, GpioState } from './useDeviceConfigOps';

type UseFleetSystemsNetworkArgs = {
    initialRange?: RangeKey;
};

export type FleetSystemsNetworkModel =
    ReturnType<typeof useSystemMetrics> &
    ReturnType<typeof useDockerOps> &
    ReturnType<typeof useDeviceConfigOps> &
    ReturnType<typeof useFleetOps> &
    ReturnType<typeof useBluetoothOps> & {
        refresh: () => Promise<void>;
    };

/**
 * Composes the fleet-systems slices (metrics, docker ops, device config,
 * fleet config) into the single model the FleetSystems context provides.
 * Each slice lives in its own hook file; this file owns cross-slice
 * effects (host selection → per-host loads) only.
 */
export default function useFleetSystemsNetwork({
    initialRange = 'hour',
}: UseFleetSystemsNetworkArgs = {}): FleetSystemsNetworkModel {
    const db = getService<IDataBaseService>('IDataBaseService');
    const adminService = getService<IAdminService>('IAdminService');

    // Filled after `refresh` exists — docker restart schedules a delayed
    // full refresh and slices can't call each other directly.
    const refreshRef = useRef<() => void>(() => { });

    const metrics = useSystemMetrics(db, initialRange);
    const docker = useDockerOps(adminService, metrics.selectedHostKey, refreshRef);
    const device = useDeviceConfigOps(adminService, metrics.selectedHostKey);
    const fleet = useFleetOps(adminService);
    const bluetooth = useBluetoothOps(adminService, metrics.selectedHostKey);

    const { selectedHostKey, range, fetchHosts, fetchTimeline } = metrics;
    const { fetchHeadlessStatus } = docker;
    const {
        fetchGpioStatus, loadDeviceConfig, loadNetworkHistory, loadNetworkAdmin,
    } = device;
    const { loadVpnStatus } = fleet;
    const { loadBluetoothDevices } = bluetooth;

    const refresh = useMemo(() => async () => {
        await fetchHosts();
        if (selectedHostKey) {
            await Promise.all([
                fetchTimeline(selectedHostKey, range),
                fetchHeadlessStatus(selectedHostKey),
            ]);
        }
    }, [fetchHeadlessStatus, fetchHosts, fetchTimeline, range, selectedHostKey]);
    refreshRef.current = refresh;

    useEffect(() => {
        fetchHosts();
        loadVpnStatus();
        const id = setInterval(() => { loadVpnStatus(); }, 90_000);
        return () => clearInterval(id);
        // loadFleetConfig is excluded — loaded lazily when the fleet tab is opened
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchHosts, loadVpnStatus]);

    useEffect(() => {
        if (!selectedHostKey) return;
        fetchTimeline(selectedHostKey, range);
        fetchHeadlessStatus(selectedHostKey);
        fetchGpioStatus(selectedHostKey);
        loadDeviceConfig(selectedHostKey);
        loadNetworkHistory(selectedHostKey);
        loadNetworkAdmin(selectedHostKey);
        loadBluetoothDevices(selectedHostKey);
    }, [fetchHeadlessStatus, fetchGpioStatus, fetchTimeline, loadDeviceConfig, loadNetworkAdmin, loadNetworkHistory, loadBluetoothDevices, range, selectedHostKey]);

    return useMemo(() => ({
        ...metrics,
        ...docker,
        ...device,
        ...fleet,
        ...bluetooth,
        refresh,
    }), [metrics, docker, device, fleet, bluetooth, refresh]);
}
