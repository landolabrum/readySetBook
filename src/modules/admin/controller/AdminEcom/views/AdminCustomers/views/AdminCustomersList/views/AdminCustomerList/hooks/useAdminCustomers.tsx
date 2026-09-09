import { getService } from "@webstack/common";
import { useEffect, useRef, useState } from "react";
import IAdminService from "~/src/core/services/AdminService/IAdminService";
import { ICustomer } from "~/src/models/ICustomer";
import AdaptTableCell from "@webstack/components/AdapTable/components/AdaptTableContent/components/AdaptTableCell/AdaptTableCell";
import styles from './../AdminCustomerList.scss';
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import canViewCustomer from "../../../functions/canViewCustomer";
import keyStringConverter from "@webstack/helpers/keyStringConverter";
import { getUserClearance, useUser } from "~/src/core/authentication/hooks/useUser";
import environment from "~/src/core/environment";

const useAdminCustomers = (initialPage?: number, initialPerPage?: number) => {
  const adminService = getService<IAdminService>('IAdminService');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(initialPage || 1);
  const [perPage, setPerPage] = useState(initialPerPage || 10);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [totalPages, setTotalPages] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const user = useUser();

  const [customers, setCustomers] = useState<ICustomer[] | undefined>();
  const requestIdRef = useRef(0);
  const refresh = () => {
    loadPage(page, perPage, searchQuery);
  };

  const loadPage = async (targetPage: number, perPageOverride?: number, searchOverride?: string) => {
    const requestId = ++requestIdRef.current;
    const safePage = targetPage < 1 ? 1 : targetPage;
    const effectivePerPage = perPageOverride ?? perPage;
    const effectiveSearch =
      typeof searchOverride === "string" ? searchOverride : searchQuery;
    setCustomers(undefined);

    // Debug logging for pagination/search requests
    // eslint-disable-next-line no-console
    console.debug("[useAdminCustomers] loadPage -> request", {
      page: safePage,
      perPage: effectivePerPage,
      search: effectiveSearch || undefined,
    });

    let customerList = await adminService.listCustomers(
      safePage,
      effectivePerPage,
      effectiveSearch || undefined
    );

    // Ignore stale responses; only apply the latest request
    if (requestId !== requestIdRef.current) {
      return;
    }

    // eslint-disable-next-line no-console
    console.debug("[useAdminCustomers] loadPage -> response", {
      status: customerList?.object,
      page: customerList?.page,
      per_page: customerList?.per_page,
      total: customerList?.total,
      dataLength: Array.isArray(customerList?.data)
        ? customerList.data.length
        : undefined,
    });
    if (customerList?.object === 'list') {
      setHasMore(Boolean(customerList.has_more));
      setPage(customerList.page || safePage);
      setPerPage(effectivePerPage);
      setTotal(
        typeof customerList.total === 'number'
          ? customerList.total
          : Array.isArray(customerList.data)
          ? customerList.data.length
          : undefined
      );
      if (typeof customerList.total_pages === 'number') {
        setTotalPages(customerList.total_pages);
      } else if (
        typeof customerList.total === 'number' &&
        typeof effectivePerPage === 'number'
      ) {
        setTotalPages(Math.max(1, Math.ceil(customerList.total / effectivePerPage)));
      }

      const rawData = customerList.data || [];

      // Trust the backend search results and only filter by view permissions.
      const transformedCustomerList = rawData
        .filter((customer: any) => customer?.id && canViewCustomer(customer, user))
        .map((customer: any) => {
          const notUser = customer.email !== user?.email;
          // const merchantName = customer?.metadata?.merchant?.name || "unknown";
          // const customerForms = customer?.metadata?.forms || {};
          // if (merchantName=="nirvana-energy")console.log(`Name: ${customer.name}, Email: ${customer.email}, Phone: ${customer.phone}`, customerForms);
          const extras = {
            ...customer.metadata,
            ...customer.invoice_settings,
            description: customer.description,
            discount: customer.discount,
            currency: customer.currency,
            invoice_prefix: customer.invoice_prefix,
            next_invoice_sequence: customer.next_invoice_sequence,
          };

          return {
            merchant: (
              <>
                <style jsx>{styles}</style>
                <div className={`d-flex ${notUser ? "" : "user"}`}>
                  <UiIcon
                    icon={
                      notUser
                        ? `${customer?.metadata?.merchant?.name}-logo`
                        : "fa-star"
                    }
                  />
                </div>
              </>
            ),
            id: customer.id,
            customer: (
              <AdaptTableCell
                cell="member"
                data={{
                  id: customer.id as string,
                  name: customer.name,
                  email: customer.email,
                  phone: customer.phone,
                }}
              />
            ),
            address: <AdaptTableCell cell="address" data={customer.address} />,
            balance: customer.balance,
            created: <AdaptTableCell cell="date" data={customer.created} />,
            default_source: (
              <AdaptTableCell
                cell="check"
                data={Boolean(customer.default_source)}
              />
            ),
            tax_exempt: (
              <AdaptTableCell
                cell="check"
                data={Boolean(customer.tax_exempt === "exempt")}
              />
            ),
            clearance: (
              <AdaptTableCell
                cell="id"
                data={keyStringConverter(
                  getUserClearance(
                    Number(customer?.metadata?.user?.clearance),
                  )?.user.type,
                  { textTransform: "capitalize" },
                )}
              />
            ),
            extras,
            quote:
              customer.metadata && (
                <AdaptTableCell
                  cell="check"
                  data={Boolean(
                    Object.entries(customer.metadata).find((f: any) =>
                      String(f).includes(String(environment.merchant.mid)),
                    ),
                  )}
                />
              ),
          };
        });

      // Set the transformed customer list in state (no undefined entries)
      setCustomers(transformedCustomerList as ICustomer[]);
    }
  };

  useEffect(() => {
    // initial load, respect initial page/limit and current searchQuery (which starts as "")
    loadPage(initialPage || 1, initialPerPage || perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    customers,
    hasMore,
    refresh,
    page,
    perPage,
    total,
    totalPages,
    applySearch: (term: string) => {
      const trimmed = term.trim();

      // Too short: clear active server-side search, once.
      if (trimmed.length < 10) {
        if (searchQuery !== "") {
          setSearchQuery("");
          loadPage(1, perPage, "");
        }
        return;
      }

      if (trimmed === searchQuery) return;

      setSearchQuery(trimmed);
      loadPage(1, perPage, trimmed);
    },
    goToPage: (target: number, search?: string) => {
      if (!target || target < 1) return;
      if (totalPages && target > totalPages) return;
      loadPage(target, undefined, search);
    },
    changeLimit: (newLimit: number, search?: string) => {
      if (!newLimit || newLimit <= 0) return;
      loadPage(1, newLimit, search);
    },
    nextPage: () => {
      const next = page + 1;
      if (totalPages && next > totalPages) return;
      if (!hasMore && totalPages && next > totalPages) return;
      loadPage(next);
    },
    prevPage: () => {
      const prev = page - 1;
      if (prev < 1) return;
      loadPage(prev);
    },
  };
};

export default useAdminCustomers;
