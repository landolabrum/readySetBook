'use client';

import React from 'react';
import styles from './AdminCustomers.scss';
import AdminCustomerAdd from '../views/AdminCustomerAdd/AdminCustomerAdd';
import AdminCustomerList from '../views/AdminCustomerList/AdminCustomerList';
import AdminCustomerDetails from '../views/AdminCustomerDetail/controller/AdminCustomerDetail';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import IAuthenticatedUser from '~/src/models/ICustomer';
import { useRouter } from 'next/router';
import UiViewLayout from '@webstack/layouts/UiViewLayout/controller/UiViewLayout';

const AdminCustomers: React.FC<{
  customers?: any[];
  hasMore?: boolean;
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
  onRefresh?: () => void;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onSearch?: (term: string) => void;
}> = ({
  customers = [],
  hasMore,
  page,
  perPage,
  total,
  totalPages,
  onRefresh,
  onPageChange,
  onLimitChange,
  onSearch,
}) => {
    const router = useRouter();
    const query = router?.query;

    const updateViewUrl = (newView?: string, customer?: IAuthenticatedUser) => {
      router.push(
        { query: { ...query, cid: customer?.id || newView } },
        undefined,
        { shallow: true }
      );
    };

    const views = {
      modify: (
        <AdminCustomerDetails
          id={query.cid}
          setView={(e: any) => updateViewUrl(e)}
        />
      ),
      list: (
        <AdminCustomerList
          customers={customers || []}
          onRefresh={onRefresh}
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
          onSearch={onSearch}
          onSelect={(row: any) => updateViewUrl('modify', row)}
        />
      ),
      add: <AdminCustomerAdd />,
    };


    if (!query?.vid || query?.vid !== 'customers') return <></>;

    return (
      <>
        <style jsx>{styles}</style>
        {/* {console.log({customers, normalizedCustomers})} */}
        <div className="admin-customer">
          <div className="admin-customer__header-container">
            <div className="actions">
              {query.cid !== 'add' && (
                <UiButton
                  traits={{ afterIcon: 'fa-user-plus' }}
                  variant="dark"
                  onClick={() => updateViewUrl('add')}
                >
                  Add
                </UiButton>
              )}
              {query.cid !== 'list' && (
                <UiButton
                  variant="dark"
                  traits={{ afterIcon: 'fa-user-group' }}
                  onClick={() => updateViewUrl('list')}
                >
                  Customers
                </UiButton>
              )}
            </div>
          </div>

          <UiViewLayout
            currentView={
              Boolean(query.cid && String(query.cid).includes('cus_'))
                ? 'modify'
                : query?.cid
                  ? String(query.cid)
                  : customers && customers.length ? 'list' : undefined
            }
            views={views}
          />
        </div>
      </>
    );
  };


export default AdminCustomers;
