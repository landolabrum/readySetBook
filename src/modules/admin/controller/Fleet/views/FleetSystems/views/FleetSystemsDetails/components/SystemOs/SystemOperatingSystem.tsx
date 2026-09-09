import React from 'react';
import SystemOsInfo from './SystemOsInfo';

type Props = { systemData: any; loading?: boolean; };

const SystemOperatingSystem: React.FC<Props> = ({ systemData, loading }) => (
    <SystemOsInfo osInfo={systemData?.os_info} loading={loading} />
);

export default SystemOperatingSystem;
