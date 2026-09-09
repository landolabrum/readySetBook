import React from 'react';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';

type Props = {
    osInfo: Record<string, string> | null | undefined;
    loading?: boolean;
};

const OS_FIELDS: { key: string; label: string }[] = [
    { key: 'name', label: 'OS' },
    { key: 'kernel', label: 'Kernel' },
    { key: 'machine', label: 'Arch' },
    { key: 'hostname', label: 'Hostname' },
    { key: 'uptime', label: 'Uptime' },
    { key: 'shell', label: 'Shell' },
];

const SystemOsInfo: React.FC<Props> = ({ osInfo, loading }) => {
    const rows = OS_FIELDS
        .filter(f => osInfo?.[f.key] != null)
        .map(f => ({ detail: f.label, value: osInfo![f.key] }));

    if (!rows.length) {
        return <span style={{ color: 'var(--gray-60)', fontSize: 'var(--s-7)' }}>No OS data available</span>;
    }

    return (
        <AdapTable
            variant="mini"
            data={rows}
            options={{ hide: 'header' as const }}
        />
    );
};

export default SystemOsInfo;
