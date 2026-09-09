import { useCallback, useState } from 'react';
import type IAdminService from '~/src/core/services/AdminService/IAdminService';

/** Fleet-wide system_config CRUD + VPN status. */
export default function useFleetOps(adminService: IAdminService) {
    const [fleetConfig, setFleetConfig] = useState<any[]>([]);
    const [fleetConfigLoading, setFleetConfigLoading] = useState(false);
    const [fleetConfigSaving, setFleetConfigSaving] = useState(false);
    const [vpnStatus, setVpnStatus] = useState<any | null>(null);
    const [vpnLoading, setVpnLoading] = useState(false);

    const loadFleetConfig = useCallback(async () => {
        setFleetConfigLoading(true);
        try {
            const res = await adminService.listFleetConfig();
            setFleetConfig(Array.isArray(res?.rows) ? res.rows : []);
        } catch (err) {
            console.error('[useFleetOps] loadFleetConfig error:', err);
            setFleetConfig([]);
        } finally {
            setFleetConfigLoading(false);
        }
    }, [adminService]);

    const saveFleetConfig = useCallback(async (key: string, value: any) => {
        if (!key) return;
        setFleetConfigSaving(true);
        try {
            await adminService.upsertFleetConfig(key, value);
            await loadFleetConfig();
        } catch (err) {
            console.error('[useFleetOps] saveFleetConfig error:', err);
        } finally {
            setFleetConfigSaving(false);
        }
    }, [adminService, loadFleetConfig]);

    const removeFleetConfig = useCallback(async (key: string) => {
        if (!key) return;
        setFleetConfigSaving(true);
        try {
            await adminService.deleteFleetConfig(key);
            await loadFleetConfig();
        } catch (err) {
            console.error('[useFleetOps] removeFleetConfig error:', err);
        } finally {
            setFleetConfigSaving(false);
        }
    }, [adminService, loadFleetConfig]);

    const revealFleetSecret = useCallback(async (name: string): Promise<string | null> => {
        try {
            const res = await adminService.revealFleetSecret(name);
            if (!res || (res as any)?.isAxiosError) return null;
            return res.value == null ? '' : String(res.value);
        } catch (err) {
            console.error('[useFleetOps] revealFleetSecret error:', err);
            return null;
        }
    }, [adminService]);

    const loadVpnStatus = useCallback(async () => {
        setVpnLoading(true);
        try {
            const res = await adminService.getVpnStatus();
            if (res && !(res as any)?.isAxiosError) {
                setVpnStatus(res);
            }
        } catch (err) {
            console.error('[useFleetOps] loadVpnStatus error:', err);
        } finally {
            setVpnLoading(false);
        }
    }, [adminService]);

    return {
        fleetConfig, fleetConfigLoading, fleetConfigSaving, vpnStatus, vpnLoading,
        loadFleetConfig, saveFleetConfig, removeFleetConfig, revealFleetSecret, loadVpnStatus,
    };
}
