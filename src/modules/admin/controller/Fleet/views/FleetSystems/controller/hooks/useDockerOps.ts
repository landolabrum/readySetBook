import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import type IAdminService from '~/src/core/services/AdminService/IAdminService';

export type UpdateScope = 'host' | 'workers' | 'all';

export interface UpdateLogEntry {
    device_id: string;
    host_key: string;
    ok: boolean;
    output?: string;
    error?: string;
    restarted?: string[];
}

/** Docker restart / headless toggle / fleet update-all actions. `refreshRef`
 *  is filled by the composing hook after all slices exist (restart wants a
 *  full refresh once the stack is back). */
export default function useDockerOps(
    adminService: IAdminService,
    selectedHostKey: string,
    refreshRef: MutableRefObject<() => void>,
) {
    const [restarting, setRestarting] = useState(false);
    const [headlessStatus, setHeadlessStatus] = useState<any>(null);
    const [headlessBusy, setHeadlessBusy] = useState(false);
    const [updatingAll, setUpdatingAll] = useState(false);
    const [updateScope, setUpdateScope] = useState<UpdateScope>('all');
    const [updateLogs, setUpdateLogs] = useState<UpdateLogEntry[]>([]);

    const headlessRequestIdRef = useRef(0);

    const fetchHeadlessStatus = useCallback(async (hostKey?: string) => {
        if (!hostKey) {
            setHeadlessStatus(null);
            return;
        }
        const requestId = ++headlessRequestIdRef.current;
        try {
            const res = await adminService.getHeadlessStatus(hostKey);
            if (requestId !== headlessRequestIdRef.current) return;
            setHeadlessStatus(res);
        } catch (err) {
            if (requestId === headlessRequestIdRef.current) {
                console.error('[useDockerOps] headless status error:', err);
            }
        }
    }, [adminService]);

    const restartDocker = useCallback(async () => {
        if (restarting || !selectedHostKey) return;
        setRestarting(true);
        try {
            await adminService.restartDocker(selectedHostKey);
        } catch (err) {
            console.error('[useDockerOps] docker restart error:', err);
        }
        setTimeout(() => {
            setRestarting(false);
            refreshRef.current();
        }, 15000);
    }, [adminService, refreshRef, restarting, selectedHostKey]);

    const toggleHeadless = useCallback(async () => {
        if (headlessBusy || !selectedHostKey) return;
        setHeadlessBusy(true);
        try {
            const action = headlessStatus?.is_headless ? 'revert' : 'enable';
            await adminService.headlessToggle(action, selectedHostKey);
            setTimeout(() => {
                fetchHeadlessStatus(selectedHostKey);
            }, 5000);
        } catch (err) {
            console.error('[useDockerOps] headless toggle error:', err);
        } finally {
            setHeadlessBusy(false);
        }
    }, [adminService, fetchHeadlessStatus, headlessBusy, headlessStatus, selectedHostKey]);

    const updateAll = useCallback(async () => {
        if (updatingAll) return;
        setUpdatingAll(true);
        setUpdateLogs([]);
        try {
            const res = await adminService.updateAll(updateScope);
            const results: UpdateLogEntry[] = Array.isArray(res?.results) ? res.results : [];
            setUpdateLogs(results);
        } catch (err) {
            console.error('[useDockerOps] update-all error:', err);
            setUpdateLogs([{
                device_id: 'unknown',
                host_key: '',
                ok: false,
                error: String(err),
            }]);
        } finally {
            setUpdatingAll(false);
        }
    }, [adminService, updatingAll, updateScope]);

    const clearUpdateLogs = useCallback(() => {
        setUpdateLogs([]);
    }, []);

    return {
        restarting, headlessStatus, headlessBusy,
        updatingAll, updateScope, updateLogs,
        fetchHeadlessStatus, restartDocker, toggleHeadless,
        updateAll, setUpdateScope, clearUpdateLogs,
    };
}
