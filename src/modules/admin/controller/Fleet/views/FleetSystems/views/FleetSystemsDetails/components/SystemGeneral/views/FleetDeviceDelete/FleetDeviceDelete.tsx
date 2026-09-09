// Relative Path: ./FleetDeviceDelete.tsx
import React from 'react';
import styles from './FleetDeviceDelete.scss';
import { IFleetSystemsDetails } from '../../../../controller/FleetSystemsDetails';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';


// Remember to create a sibling SCSS file with the same name as this component
const FleetDeviceDelete = ({ systemData, loading, range, timeline }: IFleetSystemsDetails) => {
    // console.log(systemData)
  return (
    <>
      <style jsx>{styles}</style>
      <div className='fleet-device-delete'>
        <UiButton
            disabled={!loading || !systemData}
        >
                  delete {systemData?.display_name}
        </UiButton>
        <small className='dev'>TODO delete device btn</small>
      </div>
    </>
  );
};

export default FleetDeviceDelete;