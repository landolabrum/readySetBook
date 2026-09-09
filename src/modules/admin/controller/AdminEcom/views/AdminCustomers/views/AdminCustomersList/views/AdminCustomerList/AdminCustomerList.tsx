// Relative Path: ./AdminProductList.tsx
import React, { useState } from 'react';
import styles from './AdminCustomerList.scss';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { ICustomer } from '~/src/models/ICustomer';

type AdminCustomerListProps = {
  customers: ICustomer[];
  page?: number;
  perPage?: number;
  total?: number;
  onRefresh?: () => void;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onSelect: (props: string) => void;
  onSearch?: (term: string) => void;
};

const AdminCustomerList: React.FC<AdminCustomerListProps> = ({
  customers,
  page = 1,
  perPage,
  total,
  onRefresh,
  onPageChange,
  onLimitChange,
  onSelect,
  onSearch,
}) => {
  const currentPage = page || 1;
  const [search, setSearch] = useState<string>('');

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onSearch?.(value);
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className='admin-customer-list'>
        <div className='d-flex s-w-9 justify-end s-4-bottom'>
          <div>
            <UiButton
              onClick={onRefresh}
              busy={!customers}
              traits={{ afterIcon: "fa-rotate" }}
            >
              refresh
            </UiButton>
          </div>
        </div>
        <div className='admin-customer-list__table'>
          <AdapTable
            search={search}
            setSearch={handleSearchChange}
            page={currentPage}
            limit={perPage}
            total={total}
            setPage={onPageChange}
            setLimit={onLimitChange as any}
            options={{
              tableTitle: 'customers',
              hideColumns: ['extras', 'id'],
              externalPagination: true,
              // hide:['header']
            }}
            loading={customers === undefined}
            data={customers}
            onRowClick={onSelect}
          />
        </div>
      </div>
    </>
  );
};

export default AdminCustomerList;
