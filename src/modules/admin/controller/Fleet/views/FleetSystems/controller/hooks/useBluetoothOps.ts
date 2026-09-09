import { useCallback, useRef, useState } from 'react';
import type IAdminService from '~/src/core/services/AdminService/IAdminService';

/** CRUD over the DB-backed bluetooth_devices registry for the selected host.
 *  Mirrors useDeviceConfigOps: the DB row is the source of truth; the host's
 *  BLE daemon pulls the same registry and converges on its next cycle. */
export default function useBluetoothOps(adminService: IAdminService, selectedHostKey: string) {
    const [bluetoothDevices, setBluetoothDevices] = useState<any[]>([]);
    const [bluetoothBusy, setBluetoothBusy] = useState<boolean>(false);
    const loadIdRef = useRef(0);

    const loadBluetoothDevices = useCallback(async (hostKey: string) => {
        if (!hostKey) return;
        const requestId = ++loadIdRef.current;
        try {
            const res = await adminService.listBluetoothDevices(hostKey);
            if (requestId !== loadIdRef.current) return;
            setBluetoothDevices(Array.isArray(res?.devices) ? res.devices : []);
        } catch {
            if (requestId === loadIdRef.current) setBluetoothDevices([]);
        }
    }, [adminService]);

    const saveBluetoothDevice = useCallback(async (patch: Record<string, any>) => {
        if (!selectedHostKey) return;
        setBluetoothBusy(true);
        try {
            await adminService.upsertBluetoothDevice({ host_key: selectedHostKey, ...patch });
            await loadBluetoothDevices(selectedHostKey);
        } finally {
            setBluetoothBusy(false);
        }
    }, [adminService, selectedHostKey, loadBluetoothDevices]);

    const toggleBluetoothDevice = useCallback(async (id: number, enabled: boolean) => {
        setBluetoothBusy(true);
        try {
            await adminService.setBluetoothDeviceEnabled(id, enabled);
            await loadBluetoothDevices(selectedHostKey);
        } finally {
            setBluetoothBusy(false);
        }
    }, [adminService, selectedHostKey, loadBluetoothDevices]);

    const deleteBluetoothDevice = useCallback(async (id: number) => {
        setBluetoothBusy(true);
        try {
            await adminService.deleteBluetoothDevice(id);
            await loadBluetoothDevices(selectedHostKey);
        } finally {
            setBluetoothBusy(false);
        }
    }, [adminService, selectedHostKey, loadBluetoothDevices]);

    return {
        bluetoothDevices,
        bluetoothBusy,
        loadBluetoothDevices,
        saveBluetoothDevice,
        toggleBluetoothDevice,
        deleteBluetoothDevice,
    };
}
