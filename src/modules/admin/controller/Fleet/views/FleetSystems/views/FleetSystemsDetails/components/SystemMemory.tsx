import React from 'react';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import UiBar from '@webstack/components/Graphs/UiBar/UiBar';
import styles from "./../controller/FleetSystemsDetails.scss"
type Props = { systemData: any; loading?: boolean; };

const SystemMemory: React.FC<Props> = ({ systemData }) => (<><style jsx>{styles}</style>
    <div className='card system-memory'>
        <AdapTable
            data={[{ detail: 'Usage', value: `${(systemData?.memory_percentage || 0).toFixed(1)}%` }]}
            options={{ hide: 'header' as const }}
            />
        <UiBar
            percentage={systemData?.memory_percentage || 0}
            barCount={4}
            status={systemData?.memory_percentage >= 90 ? 'high' : undefined}
            />
    </div>
            </>
);

export default SystemMemory;
