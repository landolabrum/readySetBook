// Relative Path: ./FleetSystemsDevicesTotal.tsx
import React, { useMemo } from 'react';
import styles from './FleetSystemsDevicesTotal.scss';
import type { HostRow } from '../../../../../helpers/types';
import { summarizeDevicesTotal } from '../functions/devicesTotalSummary';
import { formatPct } from '../../../../../helpers/systemUtils';

interface IFleetSystemsDevicesTotal {
    hosts: HostRow[];
}

const FleetSystemsDevicesTotal = ({ hosts }: IFleetSystemsDevicesTotal) => {
  const summary = useMemo(() => summarizeDevicesTotal(hosts), [hosts]);
  // ["deviceCount", "onlineCount", "offlineCount", "orchestratorCount", "runnerCount", "networkCount", "networkOnlineCount", "avgCpuPct", "avgMemPct", "totalMemoryBytes", "totalStorageBytes", "totalMemoryHuman", "totalStorageHuman"]
  return (
    <>
      <style jsx>{styles}</style>
        {/* {JSON.stringify(Object.keys(summary))} */}
        {/* {Object.entries(summary).map(
          ([k,v])=>{
            if (String(k).toLowerCase().substring(k.length - 5, k.length) !== 'bytes')return <>

             <div className="fleet-systems-devices-total__stat">
               <span className="fleet-systems-devices-total__value">{
                  String(k).toLowerCase().substring(k.length - 3, k.length) == 'pct'  ? formatPct(Number(v)):v
               }</span>
               <span className="fleet-systems-devices-total__label">{keyStringConverter(k,{textTransform:"capitalize"})}</span>
             </div>
            </>
          }
        )} */}

        <div className='fleet-systems-devices-total'>

            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value">{summary.deviceCount}</span>
              <span className="fleet-systems-devices-total__label">Devices</span>
            </div>
            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value fleet-systems-devices-total__value--online">{summary.onlineCount}</span>
              <span className="fleet-systems-devices-total__label">Online</span>
            </div>
            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value fleet-systems-devices-total__value--offline">{summary.offlineCount}</span>
              <span className="fleet-systems-devices-total__label">Offline</span>
            </div>
            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value">{summary.orchestratorCount}</span>
              <span className="fleet-systems-devices-total__label">Orchestrators</span>
            </div>
            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value">{summary.runnerCount}</span>
              <span className="fleet-systems-devices-total__label">Runners</span>
            </div>
            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value">{summary.networkCount}</span>
              <span className="fleet-systems-devices-total__label">Networks</span>
            </div>
            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value">{formatPct(summary.avgCpuPct)}</span>
              <span className="fleet-systems-devices-total__label">Avg CPU</span>
            </div>
            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value">{formatPct(summary.avgMemPct)}</span>
              <span className="fleet-systems-devices-total__label">Avg Memory</span>
            </div>
            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value">{summary.totalMemoryHuman}</span>
              <span className="fleet-systems-devices-total__label">Total Memory</span>
            </div>
            <div className="fleet-systems-devices-total__stat">
              <span className="fleet-systems-devices-total__value">{summary.totalStorageHuman}</span>
              <span className="fleet-systems-devices-total__label">Total Storage</span>
            </div>
        </div>
    </>
  );
};

export default FleetSystemsDevicesTotal;