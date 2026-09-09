// Relative Path: ./AdminAuto.tsx
import React from 'react';
import styles from './AdminAuto.scss';
import { useUser } from '~/src/core/authentication/hooks/useUser';
import AdminAutoAuth from '../views/AdminAutoAuth/AdminAutoAuth';

// Remember to create a sibling SCSS file with the same name as this component

const AdminAuto: React.FC = () => {
    // get vehicle info using user id, query the backend, and display it in AdminAutoVehicleInfo component else authenticate user using  component
    const {id}=useUser()||{};
  return (
    <>
      <style jsx>{styles}</style>
      <div>
        <h1>Admin Auto</h1>
        <p>Welcome to the Admin Auto dashboard. Here you can manage all your automotive-related settings and information.</p>
        {/* Add more content and components related to automotive management here */}
              {/* <AdminAutoAuth /> */}
              {/* <AdminAutoVehicleInfo /> */}
      </div>
    </>
  );
};

export default AdminAuto;