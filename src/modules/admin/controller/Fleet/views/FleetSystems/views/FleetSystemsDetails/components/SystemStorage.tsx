import React from 'react';
import RenderDiskInfo, { getUniquePhysicalDisks } from './RenderDiskInfo';
import styles from "./../controller/FleetSystemsDetails.scss"
type Props = { systemData: any; loading?: boolean; };

const SystemStorage: React.FC<Props> = ({ systemData }) => {
    const disks = getUniquePhysicalDisks(systemData?.disks);
    return (<>
    <style jsx>{styles}</style>
        <div className='fleet-systems-details__disks'>
            Storage Devices <small>{disks?.length || 0}</small>
            {disks?.map((disk: any, index: number) => (
                <RenderDiskInfo key={index} disk={disk} />
            ))}
        </div>
            </>
    );
};

export default SystemStorage;
