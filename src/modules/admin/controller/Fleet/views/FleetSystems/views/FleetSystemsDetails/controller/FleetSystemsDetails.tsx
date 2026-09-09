// Relative Path: ./FleetSystemsDetails.tsx
import React, { useMemo } from 'react';
import styles from './FleetSystemsDetails.scss';
import type { MetricRow } from '../../../helpers/types';
import type { UpdateLogEntry, UpdateScope } from '../../../controller/hooks/useFleetSystemsNetwork';
import SystemGeneral from '../components/SystemGeneral/controller/SystemGeneral';
import SystemGraphics from '../components/SystemGraphics';
import SystemProcessor from '../components/SystemProcessor';
import SystemNetwork from '../components/SystemNetwork';
import SystemVpn from '../components/SystemVpn';
import SystemMemory from '../components/SystemMemory';
import SystemStorage from '../components/SystemStorage';
import SystemOperatingSystem from '../components/SystemOs/SystemOperatingSystem';
import SystemDocker from '../components/SystemDocker/SystemDocker';
import FleetSystemsVpn from '../../FleetSystemsVpn/FleetSystemsVpn';
import FleetSystemsControls from '../../FleetSystemsControls/FleetSystemsControls';
import SystemBluetooth from '../components/SystemBluetooth/controller/SystemBluetooth';
import UiRadioLayout, { UiRadioLayoutView } from '@webstack/layouts/UiRadioLayout/controller/UiRadioLayout';

export type { MetricRow };

export type IFleetSystemsDetails = {
    systemData: any;
    timeline: MetricRow[];
    range: string;
    loading?: boolean;
    onDockerRestart?: () => void;
    dockerRestarting?: boolean;
    headlessStatus?: any;
    onHeadlessToggle?: () => void;
    headlessBusy?: boolean;
    onUpdateAll?: () => void;
    updatingAll?: boolean;
    updateScope?: UpdateScope;
    onUpdateScopeChange?: (scope: UpdateScope) => void;
    updateLogs?: UpdateLogEntry[];
    onClearUpdateLogs?: () => void;
    // Per-host service enablement (system_hosts.services — DB is truth)
    services?: Record<string, any> | null;
    serviceBusy?: Record<string, boolean>;
    savingServices?: boolean;
    onToggleService?: (flag: string, enabled: boolean) => Promise<void> | void;
    onSaveServices?: (nextServices: Record<string, any>) => Promise<void> | void;
};

const FleetSystemsDetails: React.FC<IFleetSystemsDetails> = ({
    systemData, timeline, range, loading,
    headlessStatus,
    updateLogs, onClearUpdateLogs,
    services, serviceBusy, savingServices, onToggleService, onSaveServices,
}) => {
    if (!systemData?.timestamp) return null;

    const overviewIcon = (icon: string) => ({ icon: loading ? 'spinner' : icon });

    // Surface the Bluetooth tab on any host whose BLE daemon is reporting — a
    // victron/litime snapshot is present (even with zero configured devices, so
    // the user can scan + add). Hosts without the daemon show nothing.
    const hasBluetooth = Boolean(systemData?.victron) || Boolean(systemData?.litime);
// const acceptedBluetoothDevices = ({
//     litime: (systemData.litime.available && systemData.litime?.devices.length)||0,
//     victron: (systemData.victron.available && systemData.victron?.devices.length)||0,
// });
// console.log(
//     { acceptedBluetoothDevices }
// )
    const overviewViews: UiRadioLayoutView[] = [
        {
            id: 'general', label: 'general', navigation: overviewIcon('fa-clock'), content: <SystemGeneral
                timeline={timeline}
                range={range}
                loading={loading}
                systemData={systemData}
                headlessStatus={headlessStatus}
            />
        },
        ...(hasBluetooth ? [{ id: 'bluetooth', label: 'Bluetooth', navigation: overviewIcon('fa-bluetooth'), content: <SystemBluetooth systemData={systemData} timeline={timeline} loading={loading} /> }] : []),
        {
            id: 'docker', label: 'Docker', navigation: overviewIcon('fa-docker'), content: (
                <SystemDocker
                    range={range}
                    loading={loading}
                    systemData={systemData}
                    services={services}
                    serviceBusy={serviceBusy}
                    savingServices={savingServices}
                    onToggleService={onToggleService}
                    onSaveServices={onSaveServices}
                    updateLogs={updateLogs}
                    onClearUpdateLogs={onClearUpdateLogs}
                />
            )
        },
        { id: 'operating-system', label: 'Operating System', navigation: overviewIcon('fa-server'), content: <SystemOperatingSystem systemData={systemData} loading={loading} /> },
        { id: 'graphics', label: 'Graphics', navigation: overviewIcon('fa-microchip'), content: <SystemGraphics systemData={systemData} loading={loading} /> },
        { id: 'processor', label: 'Processor', navigation: overviewIcon('fa-disc-drive'), content: <SystemProcessor systemData={systemData} loading={loading} /> },
        { id: 'network', label: 'Network', navigation: overviewIcon('fa-network-wired'), content: <SystemNetwork systemData={systemData} loading={loading} /> },
        { id: 'vpn', label: 'VPN', navigation: overviewIcon('fa-shield-halved'), content: <SystemVpn systemData={systemData} loading={loading} /> },
        { id: 'memory', label: 'Memory', navigation: overviewIcon('fa-memory'), content: <SystemMemory systemData={systemData} loading={loading} /> },
        { id: 'storage', label: 'Storage', navigation: overviewIcon('fa-hard-drive'), content: <SystemStorage systemData={systemData} loading={loading} /> },
        { id: 'fleet-vpn', label: 'Fleet VPN', navigation: { icon: 'fa-satellite-dish' }, content: <FleetSystemsVpn /> },
        { id: 'controls', label: 'Controls', navigation: { icon: 'fa-toggle-on' }, content: <FleetSystemsControls /> },
    ];

    return (
        <>
            <style jsx>{styles}</style>
            <div className='fleet-systems-details'>

                <div className="fleet-systems-details__wrapper">

                    <UiRadioLayout
                        defaultValue='general'
                        collapsed={false}
                        views={overviewViews}
                    />

                </div>


            </div>
        </>
    );
};

export default FleetSystemsDetails;
