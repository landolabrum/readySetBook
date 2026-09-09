import React, { useMemo } from 'react';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import {
    buildDockerRows,
    missingRequiredParams,
    serviceByFlag,
    serviceForContainer,
} from '../../../../helpers/hostServices';
import ServiceConfigPanel from './ServiceConfigPanel';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';

type Props = {
    range: string;
    loading?: boolean;
    systemData: any;
    services?: Record<string, any> | null;   // system_hosts.services (DB truth)
    serviceBusy?: Record<string, boolean>;
    savingServices?: boolean;
    onToggleService?: (flag: string, enabled: boolean) => Promise<void> | void;
    onSaveServices?: (nextServices: Record<string, any>) => Promise<void> | void;
};

const STATUS_COLOR = (s: string) =>
    s.startsWith('running') || s.startsWith('up') ? '#5cb85c'
        : s === 'exited' ? '#d9534f'
            : s === 'not deployed' ? '#7f8cfa'
                : '#f0ad4e';

/**
 * Container inventory for the selected device, joined against the DB's
 * desired state (system_hosts.services). Clicking a toggleable row opens
 * the parameter panel above the table; required params gate spin-up.
 */
const DockerServicesCard: React.FC<Props> = ({
    range, loading, systemData, services, serviceBusy = {}, savingServices,
    onToggleService, onSaveServices,
}) => {
    const { openModal, closeModal } = useModal();
    const rows = useMemo(
        () => buildDockerRows(systemData?.docker_containers ?? [], services),
        [systemData?.docker_containers, services],
    );

    const emptyMessage = useMemo(() => {
        if (loading) return 'Loading container inventory...';
        const state = String(systemData?.docker_state || '').toLowerCase();
        const err = String(systemData?.docker_error || '').trim();
        const base = state === 'disabled'
            ? 'Docker inventory disabled.'
            : state === 'socket_missing'
                ? 'Docker socket not mounted for this device.'
                : state === 'socket_permission'
                    ? 'Docker socket is mounted but not accessible (permissions).'
                    : state === 'client_error'
                        ? 'Docker inventory temporarily unavailable.'
                        : state === 'ok_empty'
                            ? 'No running containers detected.'
                            : 'No container data available.';
        return err ? `${base} (${err})` : base;
    }, [loading, systemData?.docker_error, systemData?.docker_state]);

    const toggleLabel = (enabled: boolean, running: boolean) => {
        if (enabled && running) return 'disable';
        if (enabled && !running) return 'starting…';
        if (!enabled && running) return 'stopping…';
        return 'enable';
    };

    const openConfigModal = (svc: ReturnType<typeof serviceByFlag>) => {
        if (!svc) return;
        openModal({
            title: svc.label ?? svc.flag,
            variant: 'popup',
            dismissable: true,
            children: (
                <ServiceConfigPanel
                    service={svc}
                    services={services}
                    saving={savingServices}
                    toggling={Boolean(serviceBusy[svc.flag])}
                    onSaveServices={(next) => onSaveServices?.(next)}
                    onToggle={(flag, enabled) => onToggleService?.(flag, enabled)}
                    onClose={closeModal}
                />
            ),
        });
    };

    const handleRowClick = (item: any) => {
        const svc = serviceForContainer({ name: item?.name, service: item?.service });
        openConfigModal(svc);
    };

    const handleToggleClick = (e: any, flag: string, enabled: boolean) => {
        e?.stopPropagation?.();
        const svc = serviceByFlag(flag);
        if (!svc) return;
        // Enabling with unset required params: open the panel instead — the
        // operator must configure the image before it spins up.
        if (enabled && missingRequiredParams(svc, services).length) {
            openConfigModal(svc);
            return;
        }
        onToggleService?.(flag, enabled);
    };

    const tableData = rows.map(row => ({
        name: row.name,
        service: row.service,
        status: row.status,
        // enabled === undefined ⇒ DB desired state not loaded (or fetch
        // failed) — show a neutral placeholder, never a false "stopping…".
        enabled: row.toggleable && row.flag ? (
            row.enabled === undefined ? (
                <span style={{ color: 'var(--gray-60)', fontSize: '11px' }}>…</span>
            ) : (
                <UiButton
                    size="xs"
                    busy={Boolean(serviceBusy[row.flag])}
                    variant={row.enabled ? 'success' : 'flat'}
                    onClick={(e: any) => handleToggleClick(e, row.flag!, !row.enabled)}
                >
                    {toggleLabel(Boolean(row.enabled), row.running)}
                </UiButton>
            )
        ) : <span style={{ color: 'var(--gray-60)', fontSize: '11px' }}>core</span>,
    }));

    return (
        <div className='ca rd'>
            <div className="card--title">
                <UiIcon icon={loading ? 'spinner' : 'fa-docker'} /> Docker ({range})
            </div>

            <div className="card--content">
                {tableData.length > 0 ? (
                    <AdapTable
                        data={tableData}
                        onRowClick={handleRowClick}
                        options={{
                            renderCell: (key, item) => {
                                if (key === 'status') {
                                    const s = String(item.status);
                                    return (
                                        <span style={{ color: STATUS_COLOR(s.toLowerCase()), fontWeight: 600 }}>
                                            {s}
                                        </span>
                                    );
                                }
                                return undefined;
                            },
                        }}
                    />
                ) : (
                    <div>{emptyMessage}</div>
                )}
            </div>
        </div>
    );
};

export default DockerServicesCard;
