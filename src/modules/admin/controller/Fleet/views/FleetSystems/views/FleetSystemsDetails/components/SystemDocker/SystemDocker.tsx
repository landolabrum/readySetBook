import React from 'react';
import DockerServicesCard from './DockerServicesCard';
import UpdateLogsCard from './UpdateLogsCard';
import type { UpdateLogEntry } from '../../../../controller/hooks/useFleetSystemsNetwork';

type Props = {
    range: string;
    loading?: boolean;
    systemData: any;
    services?: Record<string, any> | null;
    serviceBusy?: Record<string, boolean>;
    savingServices?: boolean;
    onToggleService?: (flag: string, enabled: boolean) => Promise<void> | void;
    onSaveServices?: (nextServices: Record<string, any>) => Promise<void> | void;
    updateLogs?: UpdateLogEntry[];
    onClearUpdateLogs?: () => void;
};

const SystemDocker: React.FC<Props> = ({
    range, loading, systemData,
    services, serviceBusy, savingServices, onToggleService, onSaveServices,
    updateLogs = [], onClearUpdateLogs,
}) => (
    <div className='s-9'>
        <DockerServicesCard
            range={range}
            loading={loading}
            systemData={systemData}
            services={services}
            serviceBusy={serviceBusy}
            savingServices={savingServices}
            onToggleService={onToggleService}
            onSaveServices={onSaveServices}
        />
        <UpdateLogsCard updateLogs={updateLogs} onClearUpdateLogs={onClearUpdateLogs} />
    </div>
);

export default SystemDocker;
