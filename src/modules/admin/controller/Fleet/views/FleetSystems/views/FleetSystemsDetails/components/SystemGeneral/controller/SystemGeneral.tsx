import React, { useEffect, useMemo, useRef } from 'react';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiLineGraph from '@webstack/components/Graphs/UiLineGraph/UiLineGraph';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import styles from "../../../controller/FleetSystemsDetails.scss"
import { useNotification } from '@webstack/components/Notification/Notification';
import { ApiError } from '~/src/core/services/ApiService';
import { MetricRow } from '../../../controller/FleetSystemsDetails';
import FleetDeviceDelete from '../views/FleetDeviceDelete/FleetDeviceDelete';

type Props = {
    timeline: MetricRow[];
    range: string;
    loading?: boolean;
    systemData: any;
    headlessStatus?: any;
};

const SystemGeneral: React.FC<Props> = ({
    timeline, range, loading, systemData,
    headlessStatus,
}) => {
    const [, setNotif] = useNotification();
    const shownHeadlessErrorRef = useRef<any>(null);
    const isHeadless = useMemo<boolean>(
        () => Boolean(headlessStatus && !headlessStatus.detail),
        [headlessStatus]
    );

    useEffect(() => {
        if (headlessStatus instanceof ApiError && shownHeadlessErrorRef.current !== headlessStatus) {
            const err = {
                message: headlessStatus.message ?? 'Request failed',
                status: headlessStatus.status ?? 0,
                detail: headlessStatus.detail?.detail || headlessStatus.detail,
                error: true,
            };
            shownHeadlessErrorRef.current = headlessStatus;
            setNotif({
                active: true,
                apiError: err,
                persistence: 3000
            });
        }
    }, [headlessStatus, setNotif]);
    const chartData = useMemo<Record<string, { points: { x: number; y: number }[]; color?: string }>>(() => {
        if (!timeline.length) return {} as Record<string, { points: { x: number; y: number }[]; color?: string }>;
        const clamp = (n?: number | null) => Math.max(0, Math.min(100, Number(n ?? 0)));
        const ts = (row: MetricRow) => new Date(row.ts).getTime();
        return {
            CPU: { color: '#5bc0de', points: timeline.map(row => ({ x: ts(row), y: clamp(row.cpu_pct) })) },
            MEM: { color: '#f0ad4e', points: timeline.map(row => ({ x: ts(row), y: clamp(row.mem_pct) })) },
            GPU: { color: '#7f8cfa', points: timeline.map(row => ({ x: ts(row), y: clamp(row.gpu_util_pct) })) },
        };
    }, [timeline]);

    return (<>
        <style jsx>{styles}</style>

        <div
        style={{position:'relative'}}className="fleet-systems-details__general">
            <div className='d-flex-col align-start g-9 s-w-100'>
                {systemData?.os_info?.name}

                <div>
                    <UiIcon icon={loading ? 'spinner' : 'fa-chart-line'} /> timeline ({range})
                </div>
                <div className='s-w-9'>


                    <UiLineGraph
                        variant="grid"
                        traits={{ background: 'transparent' }}
                        data={chartData}
                    />
                </div>
            </div>
            {isHeadless && (<>
                <AdapTable
                    variant="mini"
                    options={{ hide: ['header'] }}
                    data={Object.entries(headlessStatus).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])}
                />
            </>
            ) || 'go headless to see more info'
            }
    <div className='system-general__actions'>
                {systemData && !loading  &&<FleetDeviceDelete
                    range={range}
                    timeline={timeline}
                    loading={loading}
                    systemData={systemData}
                />}
    </div>

        </div>

    </>
    );
};

export default SystemGeneral;
