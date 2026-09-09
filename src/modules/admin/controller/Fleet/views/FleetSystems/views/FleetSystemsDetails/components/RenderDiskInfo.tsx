import React from 'react';
import UiBar from '@webstack/components/Graphs/UiBar/UiBar';
import styles from "./../controller/FleetSystemsDetails.scss"

export const isPhysicalDisk = (disk: any) => {
    if (disk?.device === '/') return true;
    const excludedMountPoints = [
        '/etc/', '/usr/', '/dev/', '/proc/', '/sys/', '/run/', '/snap/',
        '/var/', '/tmp/', '/boot/', '/lib/', '/bin/', '/sbin/'
    ];
    return (
        disk.device?.startsWith('/dev/') &&
        !excludedMountPoints.some((mount: string) => disk.mountpoint?.startsWith(mount)) &&
        !disk.mountpoint?.includes('docker') &&
        !disk.mountpoint?.includes('kubelet')
    );
};

export const getUniquePhysicalDisks = (disks: any[]) => {
    const physicalDisks = disks?.filter(isPhysicalDisk) || [];
    const uniqueDevices = new Set<string>();
    return physicalDisks.filter(disk => {
        const deviceBase = (disk.device || '').replace(/[0-9]/g, '');
        if (!uniqueDevices.has(deviceBase)) {
            uniqueDevices.add(deviceBase);
            return true;
        }
        return false;
    });
};

const RenderDiskInfo = ({ disk }: { disk: any }) => (<>
    <style jsx>{styles}</style>
    <div className='fleet-systems-details__disk'>
        <div className='fleet-systems-details__disk--header'>
            <div className='fleet-systems-details__disk--name'>
                {disk.model || disk.device} ({disk.mountpoint})
            </div>
            {disk.serial && disk.serial !== 'Unknown' && (
                <div className='fleet-systems-details__disk--serial'>SN: {disk.serial}</div>
            )}
        </div>
        <div className='fleet-systems-details__disk--details'>
            <UiBar
                header={`${disk.used_human} / ${disk.total_human}`}
                percentage={disk.percent_used || 0}
                barCount={4}
                status={disk.percent_used >= 90 ? 'high' : undefined}
            />
            <div className='fleet-systems-details__disk--specs'>
                <div>Filesystem: {disk.fstype}</div>
                {disk.opts && <div>Options: {disk.opts.split(',').join(', ')}</div>}
            </div>
        </div>
    </div>
</>
);

export default RenderDiskInfo;
