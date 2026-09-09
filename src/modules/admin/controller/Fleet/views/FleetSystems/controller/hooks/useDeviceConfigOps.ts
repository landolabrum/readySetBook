import { useCallback, useState } from 'react';
import type IAdminService from '~/src/core/services/AdminService/IAdminService';

export interface GpioRelay {
    id: number;
    label: string;
    pin: number;
    on: boolean;
}

export interface GpioState {
    supported: boolean;
    relays: GpioRelay[];
}

/** DB-backed device config (system_hosts row), per-host service toggles,
 *  GPIO, and network posture panels for the selected host. */
export default function useDeviceConfigOps(adminService: IAdminService, selectedHostKey: string) {
    const [gpioState, setGpioState] = useState<GpioState | null>(null);
    const [gpioLoading, setGpioLoading] = useState(false);
    const [deviceConfig, setDeviceConfig] = useState<any | null>(null);
    const [deviceConfigLoading, setDeviceConfigLoading] = useState(false);
    const [deviceConfigSaving, setDeviceConfigSaving] = useState(false);
    const [serviceBusy, setServiceBusy] = useState<Record<string, boolean>>({});
    const [networkHistory, setNetworkHistory] = useState<any[]>([]);
    const [networkHistoryLoading, setNetworkHistoryLoading] = useState(false);
    const [networkAdmin, setNetworkAdmin] = useState<any | null>(null);
    const [refreshingNetwork, setRefreshingNetwork] = useState(false);

    const fetchGpioStatus = useCallback(async (hostKey?: string) => {
        const key = hostKey || selectedHostKey;
        if (!key) {
            setGpioState(null);
            return;
        }
        setGpioLoading(true);
        try {
            const res = await adminService.getGpioStatus(key);
            setGpioState(res?.supported ? res : null);
        } catch (err) {
            console.error('[useDeviceConfigOps] gpio status error:', err);
            setGpioState(null);
        } finally {
            setGpioLoading(false);
        }
    }, [adminService, selectedHostKey]);

    const toggleGpioRelay = useCallback(async (relayId: number, on: boolean) => {
        if (!selectedHostKey) return;
        try {
            await adminService.setGpioRelay(selectedHostKey, relayId, on);
            // Optimistic update
            setGpioState(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    relays: prev.relays.map(r => r.id === relayId ? { ...r, on } : r),
                };
            });
        } catch (err) {
            console.error('[useDeviceConfigOps] gpio set error:', err);
            fetchGpioStatus();
        }
    }, [adminService, fetchGpioStatus, selectedHostKey]);

    const loadDeviceConfig = useCallback(async (hostKey?: string) => {
        const key = hostKey || selectedHostKey;
        if (!key) {
            setDeviceConfig(null);
            return;
        }
        setDeviceConfigLoading(true);
        try {
            const res = await adminService.getDeviceConfig(key);
            setDeviceConfig(res && !(res as any)?.isAxiosError ? res : null);
        } catch (err) {
            console.error('[useDeviceConfigOps] loadDeviceConfig error:', err);
            setDeviceConfig(null);
        } finally {
            setDeviceConfigLoading(false);
        }
    }, [adminService, selectedHostKey]);

    const saveDeviceConfig = useCallback(async (patch: Record<string, any>) => {
        if (!selectedHostKey || !patch || Object.keys(patch).length === 0) return;
        setDeviceConfigSaving(true);
        try {
            const res = await adminService.updateDeviceConfig(selectedHostKey, patch);
            if (res && !(res as any)?.isAxiosError) setDeviceConfig(res);

            // Live-push to the device's kiosk control server (:8899). Only fire when:
            //   - the URL is non-empty, AND
            //   - kiosk is enabled (or just got enabled in this same patch).
            // Skipping the push when disabled avoids a misleading "container down" 502.
            const prevServices = (deviceConfig as any)?.services ?? {};
            const nextServices = patch?.services ?? {};
            const prevKioskUrl = prevServices.kiosk_url ?? '';
            const newKioskUrl = nextServices.kiosk_url;
            const kioskEnabled = nextServices.kiosk ?? prevServices.kiosk ?? false;
            const urlChanged = typeof newKioskUrl === 'string' && newKioskUrl !== prevKioskUrl;
            const justEnabled = !prevServices.kiosk && nextServices.kiosk === true;
            if (kioskEnabled && (urlChanged || justEnabled) && newKioskUrl) {
                const pushRes: any = await adminService.pushKioskUrl(selectedHostKey, newKioskUrl);
                if (pushRes?.deploying) {
                    // 202: URL saved; kiosk container wasn't reachable so the device
                    // agent is deploying/reconciling it — not a failure.
                    console.info('[useDeviceConfigOps] kiosk deploying:', pushRes?.detail);
                    if (typeof window !== 'undefined')
                        window.alert('Kiosk URL saved — the device is deploying the kiosk service (allow ~1 min).');
                } else if (pushRes?.isAxiosError) {
                    const status = pushRes?.response?.status;
                    const detail = pushRes?.response?.data?.detail || pushRes?.message || 'Live push failed';
                    console.error('[useDeviceConfigOps] kiosk live-push failed:', status, detail);
                    if (typeof window !== 'undefined') window.alert(`Kiosk live-push failed (${status ?? 'network'}): ${detail}`);
                }
            }

            // If the patch touched gpio, push an apply to the device so the
            // persistent gpiod request reconciles with the new enabled set
            // immediately — de-energizes pins being disabled, claims newly-enabled
            // ones — rather than waiting for the 30s device_config cache TTL.
            if (Object.prototype.hasOwnProperty.call(patch, 'gpio')) {
                const applyRes: any = await adminService.applyGpioConfig(selectedHostKey);
                if (applyRes?.isAxiosError) {
                    const status = applyRes?.response?.status;
                    const detail = applyRes?.response?.data?.detail || applyRes?.message || 'GPIO apply failed';
                    console.error('[useDeviceConfigOps] gpio apply failed:', status, detail);
                    if (typeof window !== 'undefined') window.alert(`GPIO apply failed (${status ?? 'network'}): ${detail}`);
                }
            }
        } catch (err) {
            console.error('[useDeviceConfigOps] saveDeviceConfig error:', err);
        } finally {
            setDeviceConfigSaving(false);
        }
    }, [adminService, selectedHostKey, deviceConfig]);

    /** Flip one system_hosts.services flag and let the device reconcile its
     *  container set (POST /system/hosts/{key}/services/{flag}). The DB stays
     *  authoritative: an unreachable device converges on its next self-update
     *  tick, reboot, or `mindburn -update-all`. */
    const toggleService = useCallback(async (serviceKey: string, enabled: boolean) => {
        if (!selectedHostKey || !serviceKey) return;
        setServiceBusy(prev => ({ ...prev, [serviceKey]: true }));
        try {
            const res: any = await adminService.toggleHostService(selectedHostKey, serviceKey, enabled);
            if (res && !res.isAxiosError && res.ok) {
                setDeviceConfig((prev: any) => prev ? { ...prev, services: res.services } : prev);
                if (!res.applying && typeof window !== 'undefined') {
                    window.alert(
                        `services.${serviceKey} saved, but the device agent was unreachable — `
                        + 'the container set converges on the next update-all / self-update / reboot.',
                    );
                }
            } else {
                const detail = res?.response?.data?.detail || res?.message || 'toggle failed';
                console.error('[useDeviceConfigOps] toggleService failed:', detail);
                if (typeof window !== 'undefined') window.alert(`Service toggle failed: ${detail}`);
            }
        } finally {
            setServiceBusy(prev => ({ ...prev, [serviceKey]: false }));
        }
    }, [adminService, selectedHostKey]);

    const revealHostSecret = useCallback(async (hostKey: string, secretKey: string): Promise<string | null> => {
        if (!hostKey || !secretKey) return null;
        try {
            const res = await adminService.revealDeviceSecret(hostKey, secretKey);
            if (!res || (res as any)?.isAxiosError) return null;
            return res.value == null ? '' : String(res.value);
        } catch (err) {
            console.error('[useDeviceConfigOps] revealHostSecret error:', err);
            return null;
        }
    }, [adminService]);

    const loadNetworkHistory = useCallback(async (hostKey?: string) => {
        const key = hostKey || selectedHostKey;
        if (!key) {
            setNetworkHistory([]);
            return;
        }
        setNetworkHistoryLoading(true);
        try {
            const res = await adminService.getDeviceNetworkHistory(key, 25);
            setNetworkHistory(Array.isArray(res?.networks) ? res.networks : []);
        } catch (err) {
            console.error('[useDeviceConfigOps] loadNetworkHistory error:', err);
            setNetworkHistory([]);
        } finally {
            setNetworkHistoryLoading(false);
        }
    }, [adminService, selectedHostKey]);

    const loadNetworkAdmin = useCallback(async (hostKey?: string) => {
        const key = hostKey || selectedHostKey;
        if (!key) {
            setNetworkAdmin(null);
            return;
        }
        try {
            const res = await adminService.getNetworkAdminPanel(key);
            setNetworkAdmin(res && !(res as any)?.isAxiosError ? res : null);
        } catch (err) {
            console.error('[useDeviceConfigOps] loadNetworkAdmin error:', err);
            setNetworkAdmin(null);
        }
    }, [adminService, selectedHostKey]);

    const refreshNetwork = useCallback(async (hostKey?: string) => {
        const key = hostKey || selectedHostKey;
        if (!key || refreshingNetwork) return;
        setRefreshingNetwork(true);
        try {
            await adminService.refreshDeviceNetwork(key);
            await Promise.all([
                loadDeviceConfig(key),
                loadNetworkHistory(key),
            ]);
        } catch (err) {
            console.error('[useDeviceConfigOps] refreshNetwork error:', err);
        } finally {
            setRefreshingNetwork(false);
        }
    }, [adminService, loadDeviceConfig, loadNetworkHistory, refreshingNetwork, selectedHostKey]);

    return {
        gpioState, gpioLoading, deviceConfig, deviceConfigLoading, deviceConfigSaving,
        serviceBusy, networkHistory, networkHistoryLoading, networkAdmin, refreshingNetwork,
        fetchGpioStatus, toggleGpioRelay, loadDeviceConfig, saveDeviceConfig,
        toggleService, revealHostSecret, loadNetworkHistory, loadNetworkAdmin, refreshNetwork,
    };
}
