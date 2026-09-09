import React from 'react';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import { tempCell } from '../../../helpers/tempCell';

type Props = { systemData: any; loading?: boolean; };

const SystemGraphics: React.FC<Props> = ({ systemData }) => (<div>
    <AdapTable
        data={[
            { detail: 'Utilization', value: systemData?.gpu_util_pct != null ? `${Number(systemData.gpu_util_pct).toFixed(1)}%` : 'n/a' },
            ...(systemData?.gpu_mem_total_mb ? [{ detail: 'VRAM', value: `${systemData.gpu_mem_used_mb ?? 0} / ${systemData.gpu_mem_total_mb} MB` }] : []),
            { detail: 'Temperature', value: typeof systemData?.gpu_temp === 'number' ? `${systemData.gpu_temp}°C` : 'n/a' },
        ]}
        options={{
            hide: 'header' as const,
            renderCell: (key: string, item: any) => {
                if (key === 'value' && item.detail === 'Temperature')
                    return tempCell(systemData?.gpu_temp, systemData?.gpu_temp_color_pct);
                return undefined;
            },
        }}
    />
</div>
);

export default SystemGraphics;
