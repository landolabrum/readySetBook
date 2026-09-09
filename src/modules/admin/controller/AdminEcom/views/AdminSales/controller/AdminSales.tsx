
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './AdminSales.scss';
import AdaptGrid from '@webstack/components/Containers/AdaptGrid/AdaptGrid';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import environment from '~/src/core/environment';
import { useClearance } from '~/src/core/authentication/hooks/useUser';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import { useFormState } from '@webstack/components/UiForm/functions/useFormState';

const AdminSales: React.FC<any> = () => {
  // AdminService left as a future enhancement; not required here.
  const { mid } = environment.merchant;
  const clearance = useClearance();
  const apiBase = environment?.serviceEndpoints?.home || '';

  const [intents, setIntents] = useState<any[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selectedIntent, setSelectedIntent] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | undefined>(undefined);
  const [searchFields, setSearchFields] = useFormState([
    { name: 'name', label: 'Name', type: 'text', value: '' } as IFormField,
    { name: 'email', label: 'Email', type: 'text', value: '' } as IFormField,
    { name: 'product', label: 'Product', type: 'text', value: '' } as IFormField,
    { name: 'address', label: 'Address', type: 'text', value: '' } as IFormField,
    { name: 'intentId', label: 'Intent ID', type: 'text', value: '' } as IFormField,
  ]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState<number | undefined>(undefined);

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const formatAmount = (amount?: number, currency?: string) => {
    if (amount === undefined || amount === null) return '—';
    return `$${(amount / 100).toFixed(2)} ${currency?.toUpperCase?.() || 'USD'}`;
  };

  const formatDate = (created?: number) => {
    if (created === undefined || created === null) return '—';
    return new Date(created * 1000).toLocaleString();
  };

  const deriveMerchantMid = (pi: any) => (
    pi?.metadata?.mid
    || pi?.metadata?.merchant_mid
    || pi?.metadata?.merchant_id
    || pi?.metadata?.merchant
    || pi?.charges?.data?.[0]?.metadata?.mid
    || pi?.cart_items?.[0]?.metadata?.mid
    || pi?.cart_items?.[0]?.price?.metadata?.mid
    || ''
  );

  const getCustomerId = (intent?: any) => {
    if (!intent?.customer) return undefined;
    return typeof intent.customer === 'string' ? intent.customer : intent.customer.id;
  };

  const getCustomerLabel = (intent?: any) => {
    const customer = intent?.customer;
    if (!customer) return '—';
    if (typeof customer === 'string') return customer;
    return customer.email || customer.name || customer.id || '—';
  };

  const getProductQuantity = (pi: any) => {
    let total = 0;
    if (Array.isArray(pi?.cart_items) && pi.cart_items.length > 0) {
      total += pi.cart_items.reduce((sum: number, item: any) => {
        const qty = Number(item?.quantity ?? item?.qty ?? 1);
        return sum + (Number.isFinite(qty) ? qty : 1);
      }, 0);
    }

    const metaQty = Number(pi?.metadata?.quantity ?? pi?.metadata?.qty);
    if (Number.isFinite(metaQty)) total += metaQty;

    // Default to 1 item when nothing explicit is provided
    if (total === 0) total = 1;

    return total;
  };

  const handleSearchChange = (e: any) => {
    setSearchFields(e);
    setPage(1);
  };

  const handleLimitChange = (limit: number) => {
    setPerPage(limit);
    setPage(1);
  };

  const normalize = (value: any) => (value === undefined || value === null ? '' : String(value)).toLowerCase();

  const matchNeedle = (haystack: string | undefined, needle: string) => {
    if (!needle) return true;
    if (!haystack) return false;
    return haystack.toLowerCase().includes(needle);
  };

  const getProductLabels = (pi: any) => {
    const labels: string[] = [];

    if (Array.isArray(pi?.cart_items)) {
      pi.cart_items.forEach((item: any) => {
        const prodName =
          item?.product?.name
          || item?.price?.product?.name
          || item?.metadata?.product_name
          || item?.price?.metadata?.product_name
          || item?.description;
        if (prodName) labels.push(String(prodName));
      });
    }

    const metaName = pi?.metadata?.product_name || pi?.metadata?.product || pi?.metadata?.item_name;
    if (metaName) labels.push(String(metaName));

    return labels;
  };

  const getAddressStrings = (pi: any) => {
    const addresses: string[] = [];

    const pushAddr = (addr: any) => {
      if (!addr) return;
      const parts = [
        addr?.line1,
        addr?.line2,
        addr?.city,
        addr?.state,
        addr?.postal_code,
        addr?.country,
      ].filter(Boolean);
      if (parts.length > 0) addresses.push(parts.join(' '));
    };

    pushAddr(pi?.shipping?.address);
    pushAddr(pi?.customer?.address);
    pushAddr(pi?.charges?.data?.[0]?.billing_details?.address);
    pushAddr(pi?.payment_method?.billing_details?.address);

    return addresses;
  };

  const filteredIntents = useMemo(() => intents || [], [intents]);

  const hasSearch = useMemo(() => searchFields.some((f) => normalize(f?.value).trim().length > 0), [searchFields]);

  const weekStats = useMemo(() => {
    if (!intents || intents.length === 0) {
      return {
        weekIntents: [],
        productsSold: 0,
        totalAmount: 0,
        successCount: 0,
        avgAmount: 0,
        totalIntents: 0,
        newCustomersCount: 0,
        weekCustomersCount: 0,
        currency: undefined,
      };
    }

    const nowMs = Date.now();
    const weekStartMs = nowMs - WEEK_MS;
    const weekIntents = intents.filter((pi) => {
      const createdMs = pi?.created ? pi.created * 1000 : 0;
      return createdMs >= weekStartMs;
    });

    const priorIntents = intents.filter((pi) => {
      const createdMs = pi?.created ? pi.created * 1000 : 0;
      return createdMs < weekStartMs;
    });

    const productsSold = weekIntents.reduce((sum: number, pi: any) => sum + getProductQuantity(pi), 0);
    const totalAmount = weekIntents.reduce((sum: number, pi: any) => sum + (Number(pi?.amount) || 0), 0);
    const successCount = weekIntents.filter((pi) => pi?.status === 'succeeded').length;
    const avgAmount = weekIntents.length > 0 ? Math.round(totalAmount / weekIntents.length) : 0;

    const weekCustomers = new Set<string>();
    const priorCustomers = new Set<string>();

    weekIntents.forEach((pi) => {
      const cid = getCustomerId(pi);
      if (cid) weekCustomers.add(cid);
    });

    priorIntents.forEach((pi) => {
      const cid = getCustomerId(pi);
      if (cid) priorCustomers.add(cid);
    });

    const newCustomersCount = Array.from(weekCustomers).filter((cid) => !priorCustomers.has(cid)).length;

    const currency = weekIntents.find((pi) => pi?.currency)?.currency;

    return {
      weekIntents,
      productsSold,
      totalAmount,
      successCount,
      avgAmount,
      totalIntents: weekIntents.length,
      newCustomersCount,
      weekCustomersCount: weekCustomers.size,
      currency,
    };
  }, [intents]);

  const getTransactions = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      // derive query params from form state
      const name = String(searchFields.find((f) => f.name === 'name')?.value || '').trim();
      const email = String(searchFields.find((f) => f.name === 'email')?.value || '').trim();
      const product = String(searchFields.find((f) => f.name === 'product')?.value || '').trim();
      const address = String(searchFields.find((f) => f.name === 'address')?.value || '').trim();
      const intentId = String(searchFields.find((f) => f.name === 'intentId')?.value || '').trim();

      if (name) params.set('name', name);
      if (email) params.set('email', email);
      if (product) params.set('product', product);
      if (address) params.set('address', address);
      if (intentId) params.set('intent_id', intentId);

      const res = await fetch(`${apiBase}/payment-intent/s?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setIntents([]);
        setError((err?.detail || err?.message || `Status ${res.status}`));
        return;
      }

      const body = await res.json();
      const items = Array.isArray(body?.data) ? body.data : [];

      // if clearance below 11, filter to merchant `mid` on the product sold
      const lowerMid = (mid || '').toLowerCase();
      const filtered = clearance < 11
        ? items.filter((pi: any) => {
          const metadataMid = (pi?.metadata?.mid || pi?.metadata?.merchant_mid || pi?.metadata?.merchant_id || pi?.metadata?.merchant || '').toString().toLowerCase();
          const chargeMid = (pi?.charges?.data?.[0]?.metadata?.mid || '').toString().toLowerCase();
          const cartItemMid = (pi?.cart_items?.[0]?.metadata?.mid || pi?.cart_items?.[0]?.price?.metadata?.mid || '').toString().toLowerCase();
          // Accept any matching mid candidate
          return [metadataMid, chargeMid, cartItemMid].some((v) => v && v === lowerMid);
        })
        : items;
      setIntents(filtered);
      const serverTotal = Number(body?.pagination?.total);
      const filteredTotal = filtered.length;
      const totalForUser = clearance < 11
        ? filteredTotal
        : (Number.isFinite(serverTotal) ? serverTotal : filteredTotal);
      setTotal(totalForUser);
    } catch (error: any) {
      setIntents([]);
      setError(error?.message || String(error));
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiBase, clearance, mid, page, perPage, searchFields]);

  useEffect(() => {
    const timer = setTimeout(() => {
      getTransactions();
    }, 400);
    return () => clearTimeout(timer);
    // Re-fetch when clearance or merchant mid changes
  }, [getTransactions, clearance, mid]);

  const handleBackToList = () => {
    setSelectedIntent(null);
    setDetailError(undefined);
  };

  const loadIntentDetails = async (intentId: string) => {
    if (!intentId) return;

    const fallback = intents?.find((pi) => pi.id === intentId) || null;
    setSelectedIntent(fallback);
    setDetailLoading(true);
    setDetailError(undefined);

    try {
      const res = await fetch(`${apiBase}/payment-intent/${intentId}`, { credentials: 'include' });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload?.detail || payload?.message || `Status ${res.status}`);
      }

      setSelectedIntent(payload?.data || fallback);
    } catch (err: any) {
      setSelectedIntent(fallback);
      setDetailError(err?.message || String(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const tableData = useMemo(() => (
    filteredIntents?.map((pi: any) => ({
      id: pi.id,
      amount: formatAmount(pi.amount, pi.currency),
      status: pi.status,
      customer: getCustomerLabel(pi),
      merchant_mid: deriveMerchantMid(pi),
      created: formatDate(pi.created),
    })) || []
  ), [filteredIntents]);

  const renderCell = (key: string, item: any) => {
    if (key === 'status') {
      const statusKey = item.status || 'unknown';
      return (
        <span className={`admin-sales__status-pill admin-sales__status-pill--${statusKey}`}>
          {statusKey}
        </span>
      );
    }
    return undefined;
  };

  const handleTableRowClick = (row: any) => {
    if (!row?.id) return;
    loadIntentDetails(row.id);
  };

  const customerId = getCustomerId(selectedIntent);

  const previousIntents = useMemo(() => {
    if (!customerId || !intents) return [];
    return intents
      .filter((pi) => pi.id !== selectedIntent?.id && getCustomerId(pi) === customerId)
      .sort((a, b) => (b?.created || 0) - (a?.created || 0));
  }, [customerId, intents, selectedIntent?.id]);

  const previousTableData = previousIntents.map((pi) => ({
    id: pi.id,
    amount: formatAmount(pi.amount, pi.currency),
    status: pi.status,
    created: formatDate(pi.created),
  }));

  const latestCharge = selectedIntent?.latest_charge || selectedIntent?.charges?.data?.[0];

  const successRateLabel = weekStats.totalIntents
    ? `${Math.round((weekStats.successCount / weekStats.totalIntents) * 100)}%`
    : 'n/a';

  const overviewCards = [
    {
      label: 'New Customers',
      value: weekStats.newCustomersCount ?? 0,
      hint: `${weekStats.weekCustomersCount} total this week`,
    },
    {
      label: 'Products Sold',
      value: weekStats.productsSold ?? 0,
      hint: `${weekStats.totalIntents} payment intents`,
    },
    {
      label: 'Gross Volume',
      value: formatAmount(weekStats.totalAmount, weekStats.currency),
      hint: `Avg ticket ${formatAmount(weekStats.avgAmount, weekStats.currency)}`,
    },
    {
      label: 'Success Rate',
      value: successRateLabel,
      hint: `${weekStats.successCount}/${weekStats.totalIntents || 0} succeeded`,
    },
  ];

  const renderDetailView = () => {
    if (!selectedIntent) return null;

    const merchantMid = deriveMerchantMid(selectedIntent);
    const customerLabel = getCustomerLabel(selectedIntent);
    const metadataEntries = Object.entries(selectedIntent?.metadata || {});
    const statusKey = selectedIntent.status || 'unknown';

    return (
      <div className='admin-sales__detail'>
        <div className='admin-sales__detail-head'>
          <UiButton onClick={handleBackToList} traits={{ beforeIcon: 'fa-arrow-left' }}>
            Back to payment intents
          </UiButton>

          <div className={`admin-sales__status-pill admin-sales__status-pill--${statusKey}`}>
            {statusKey}
          </div>
        </div>

        {detailError && (
          <div className='admin-mgmt__error'>
            {`Showing cached data. ${detailError}`}
          </div>
        )}

        {detailLoading && <div className='admin-mgmt__state'>Loading payment intent...</div>}

        <div className='admin-sales__summary-grid'>
          <div className='admin-sales__summary-card'>
            <div className='admin-sales__summary-label'>Amount</div>
            <div className='admin-sales__summary-value'>{formatAmount(selectedIntent.amount, selectedIntent.currency)}</div>
          </div>
          <div className='admin-sales__summary-card'>
            <div className='admin-sales__summary-label'>Created</div>
            <div className='admin-sales__summary-value'>{formatDate(selectedIntent.created)}</div>
          </div>
          <div className='admin-sales__summary-card'>
            <div className='admin-sales__summary-label'>Merchant</div>
            <div className='admin-sales__summary-value'>{merchantMid || '—'}</div>
          </div>
          <div className='admin-sales__summary-card'>
            <div className='admin-sales__summary-label'>Customer</div>
            <div className='admin-sales__summary-value'>{customerLabel}</div>
          </div>
        </div>

        <div className='admin-sales__section'>
          <h5>Transaction</h5>
          <div className='admin-sales__meta-grid'>
            <div className='admin-sales__meta'>
              <div className='admin-sales__meta-label'>Intent ID</div>
              <code className='admin-sales__meta-value'>{selectedIntent.id}</code>
            </div>
            <div className='admin-sales__meta'>
              <div className='admin-sales__meta-label'>Currency</div>
              <div className='admin-sales__meta-value'>{selectedIntent.currency?.toUpperCase?.() || 'USD'}</div>
            </div>
            {selectedIntent.invoice && (
              <div className='admin-sales__meta'>
                <div className='admin-sales__meta-label'>Invoice</div>
                <code className='admin-sales__meta-value'>
                  {typeof selectedIntent.invoice === 'string' ? selectedIntent.invoice : selectedIntent.invoice?.id}
                </code>
              </div>
            )}
          </div>
        </div>

        {latestCharge && (
          <div className='admin-sales__section'>
            <h5>Latest charge</h5>
            <div className='admin-sales__meta-grid'>
              <div className='admin-sales__meta'>
                <div className='admin-sales__meta-label'>Charge ID</div>
                <code className='admin-sales__meta-value'>{latestCharge.id}</code>
              </div>
              {latestCharge.outcome?.seller_message && (
                <div className='admin-sales__meta'>
                  <div className='admin-sales__meta-label'>Outcome</div>
                  <div className='admin-sales__meta-value'>{latestCharge.outcome.seller_message}</div>
                </div>
              )}
              {latestCharge.receipt_url && (
                <div className='admin-sales__meta'>
                  <div className='admin-sales__meta-label'>Receipt</div>
                  <a className='admin-sales__meta-link' href={latestCharge.receipt_url} target='_blank' rel='noreferrer'>
                    View receipt
                  </a>
                </div>
              )}
              {latestCharge.payment_method_details?.card && (
                <div className='admin-sales__meta'>
                  <div className='admin-sales__meta-label'>Card</div>
                  <div className='admin-sales__meta-value'>
                    {`${latestCharge.payment_method_details.card.brand?.toUpperCase?.() || 'CARD'} •••• ${latestCharge.payment_method_details.card.last4}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {metadataEntries.length > 0 && (
          <div className='admin-sales__section'>
            <h5>Metadata</h5>
            <div className='admin-sales__meta-grid'>
              {metadataEntries.map(([key, value]) => (
                <div className='admin-sales__meta' key={key}>
                  <div className='admin-sales__meta-label'>{key}</div>
                  <div className='admin-sales__meta-value'>{String(value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {customerId && (
          <div className='admin-sales__section'>
            <h5>Previous payment intents for this customer</h5>
            {previousIntents.length > 0 ? (
              <AdapTable
                data={previousTableData}
                onRowClick={handleTableRowClick}
                options={{ tableTitle: 'History', hoverable: true, hideColumns: ['id'], renderCell }}
              />
            ) : (
              <div className='admin-mgmt__state'>No previous payment intents for this customer.</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderListView = () => (
    <>
      <div className='admin-sales__search'>
        <UiForm
          title="Search Payment Intents"
          fields={searchFields}
          onChange={(e: any) => handleSearchChange(e)}
          onSubmit={() => { setPage(1); getTransactions(); }}
          submitText='Search'
        />
        <div className='admin-sales__search-actions'>
          <UiButton onClick={() => {
            setSearchFields([
              { name: 'name', label: 'Name', type: 'text', value: '' } as IFormField,
              { name: 'email', label: 'Email', type: 'text', value: '' } as IFormField,
              { name: 'product', label: 'Product', type: 'text', value: '' } as IFormField,
              { name: 'address', label: 'Address', type: 'text', value: '' } as IFormField,
              { name: 'intentId', label: 'Intent ID', type: 'text', value: '' } as IFormField,
            ]); setPage(1); getTransactions();
          }} variant='ghost'>
            Clear
          </UiButton>
        </div>
      </div>
      {loading && <div>Loading payment intents...</div>}
      {error && <div className='admin-mgmt__error'>Error: {error}</div>}
      {!loading && tableData && tableData.length === 0 && (
        <div className='admin-mgmt__state'>
          {hasSearch ? 'No payment intents match your search.' : 'No payment intents found.'}
        </div>
      )}
      {!loading && tableData && tableData.length > 0 && (
        <AdapTable
          data={tableData}
          onRowClick={handleTableRowClick}
          options={{
            tableTitle: 'All Payment Intents',
            hoverable: true,
            hideColumns: ['id'],
            renderCell,
            externalPagination: true,
          }}
          page={page}
          limit={perPage}
          total={total}
          setPage={setPage}
          setLimit={handleLimitChange as any}
        />
      )}
    </>
  );
  return (
    <>
      <style jsx>{styles}</style>
      <div className='admin-mgmt admin-sales'>
        <div className='admin-mgmt__header'>
        </div>
        <div className='admin-mgmt__body'>
          <AdaptGrid xs={2} md={4} variant='card' gap={10} margin={`var(--s-4) 0`}>
            {overviewCards.map((card) => (
              <div className='admin-mgmt__card' key={card.label}>
                <div className='admin-mgmt__card-header'>{card.label}</div>
                <div className='admin-mgmt__card-body'>
                  <div className='admin-sales__card-value'>{card.value}</div>
                  {card.hint && <div className='admin-sales__card-hint'>{card.hint}</div>}
                </div>
              </div>
            ))}
          </AdaptGrid>
        </div>
        <div className='admin-mgmt__body'>
          <h4>Payment Intents</h4>
          {selectedIntent ? renderDetailView() : renderListView()}
        </div>
      </div>
    </>
  );
};

export default AdminSales;
