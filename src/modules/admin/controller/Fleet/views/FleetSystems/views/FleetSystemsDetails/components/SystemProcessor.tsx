import React from 'react';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import { tempCell } from '../../../helpers/tempCell';

type Props = { systemData: any; loading?: boolean; };

const SystemProcessor: React.FC<Props> = ({ systemData }) => (<div>
    <AdapTable
        data={[
            { detail: 'Utilization', value: `${(systemData?.cpu_pct ?? 0).toFixed(1)}%` },
            { detail: 'Temperature', value: typeof systemData?.cpu_temp === 'number' ? `${systemData.cpu_temp}°C` : 'n/a' },
        ]}
        options={{
            hide: 'header' as const,
            renderCell: (key: string, item: any) => {
                if (key === 'value' && item.detail === 'Temperature')
                    return tempCell(systemData?.cpu_temp, systemData?.cpu_temp_color_pct);
                return undefined;
            },
        }}
    /></div>
);

export default SystemProcessor;
