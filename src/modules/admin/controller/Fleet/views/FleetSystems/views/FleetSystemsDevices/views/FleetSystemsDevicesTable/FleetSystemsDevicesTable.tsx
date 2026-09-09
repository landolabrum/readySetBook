// Relative Path: ./FleetSystemsDevicesTable.tsx
import React from 'react';
import styles from './FleetSystemsDevicesTable.scss';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';

type Props = {
  data: any[];
  loading?: boolean;
  onSelectHost: (hostKey: string) => void;
};

const FleetSystemsDevicesTable: React.FC<Props> = ({ data, loading, onSelectHost }) => {
  return (
    <>
      <style jsx>{styles}</style>

      <AdapTable
        data={data}
        loading={loading}
        options={{
          hideColumns: ['host_key'],
          tableTitle: 'Devices',
        }}
        onRowClick={(row: any) => {
          if (row?.host_key) onSelectHost(row.host_key);
        }}
        />
    </>
  );
};

export default FleetSystemsDevicesTable;
