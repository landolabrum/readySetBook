import { useCallback, useEffect, useState } from "react";
import { getService } from "@webstack/common";
import useSessionStorage from "@webstack/hooks/storage/useSessionStorage";
import { useLoader } from "@webstack/components/Loader/Loader";
import IProductService from "~/src/core/services/ProductService/IProductService";
import { IProduct } from "~/src/models/Shopping/IProduct";
import environment from "~/src/core/environment";
import type { ApiError } from "~/src/core/services/ApiService";

type Filter = {
  name: string;
  value: any;
  method?: "equals" | "greaterThan" | "lessThan" | "includes";
};

interface UseProductsOptions {
  showAll?: boolean;
  serverRefresh?: boolean;    // allows fetch even when products exist
  filters?: Filter[];
  setFilters?: (filters: Filter[]) => void;
  limit?: number;
}

interface FetchOptions {
  bypassCache?: boolean;      // NEW: force skip session cache and refetch
  showLoader?: boolean;       // NEW: optionally hide global loader
}

export const useProducts = (
  { showAll = false, filters = [], setFilters, serverRefresh, limit = 10 }: UseProductsOptions = {}
) => {
  const { mid } = environment.merchant;
  const EXPIRY_MS = 60_000; // 1 minute

  const productService = getService<IProductService>("IProductService");
  const { sessionData, setSessionItem } = useSessionStorage();
  const [products, setProducts] = useState<IProduct[] | null>(null);
  const [rawProducts, setRawProducts] = useState<IProduct[] | null>(null);
  const [current, setCurrent] = useState<IProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [liveMode, setLiveMode] = useState<boolean | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [, setLoader] = useLoader();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});

  const getValue = (obj: any, path: string): any =>
    path.split(".").reduce((acc, part) => acc?.[part], obj);

  const applyFilters = useCallback(
    (list: IProduct[], fltrs: Filter[]) => {
      if (!fltrs?.length) return list;
      return list.filter((product) =>
        fltrs.every(({ name, value, method = "equals" }) => {
          const target = getValue(product, name);
          switch (method) {
            case "equals":
              return target == value;
            case "greaterThan":
              return Number(target) > Number(value);
            case "lessThan":
              return Number(target) < Number(value);
            case "includes":
              return Array.isArray(target)
                ? target.includes(value)
                : String(target ?? "").includes(String(value ?? ""));
            default:
              return true;
          }
        })
      );
    },
    []
  );

  // Apply search query filter
  const applySearch = useCallback(
    (list: IProduct[], query: string) => {
      if (!query.trim()) return list;
      const q = query.toLowerCase();
      return list.filter((product) => {
        const searchableText = [
          product.name,
          product.description,
          product.metadata?.category,
          ...(product.prices?.map((p: any) => p.nickname) || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchableText.includes(q);
      });
    },
    []
  );

  // Apply category filter
  const applyCategoryFilter = useCallback(
    (list: IProduct[], category: string | null) => {
      if (!category) return list;
      return list.filter(
        (product) => product.metadata?.category === category
      );
    },
    []
  );

  // Apply price range filter
  const applyPriceFilter = useCallback(
    (list: IProduct[], range: { min?: number; max?: number }) => {
      if (!range.min && !range.max) return list;
      return list.filter((product) => {
        const price = product.price?.unit_amount || 0;
        if (range.min && price < range.min) return false;
        if (range.max && price > range.max) return false;
        return true;
      });
    },
    []
  );

  // Treat products as active by default unless explicitly disabled
  const activeFilter = (list: IProduct[]) => list.filter((p) => p?.active !== false);

  // Scope products to this merchant, but allow legacy items
  // that don't yet have metadata.mid set.
  const merchantProductFilter = (list: IProduct[]) =>
    list.filter((p) => !p?.metadata?.mid || p.metadata.mid === mid);

  const loadFromCache = useCallback(() => {
    const raw = sessionData?.products;
    if (!raw) return false;

    const payload = (raw as any)?.value ?? raw;
    if (!payload) return false;

    const now = Date.now();
    const hasExplicitExpiry = typeof payload.expiry === "number";
    if (hasExplicitExpiry && now > payload.expiry) return false;

    const created: number | undefined = payload.created;
    if (!hasExplicitExpiry) {
      if (!created) return false;
      if (now - created > EXPIRY_MS) return false;
    }

    const backendList: IProduct[] = payload.data || [];
    // If the backend returned nothing (or a prior failed fetch stored an empty payload),
    // treat as a cache miss so we attempt a real fetch.
    if (!Array.isArray(backendList) || backendList.length === 0) return false;

    let list: IProduct[] = backendList;
    if (!showAll) list = merchantProductFilter(activeFilter(list));
    if (filters.length) list = applyFilters(list, filters);

    // Apply search and filters from state
    list = applySearch(list, searchQuery);
    list = applyCategoryFilter(list, categoryFilter);
    list = applyPriceFilter(list, priceRange);

    setRawProducts(list);
    setProducts(list);
    setTotal(list.length);
    // Only show "Load More" if backend says has_more AND we're showing fewer items than requested
    const shouldShowMore = Boolean(payload.has_more) && list.length >= limit;
    setHasMore(shouldShowMore);
    setLiveMode(payload.live_mode as boolean | undefined);
    return true;
  }, [sessionData, showAll, filters, applyFilters, EXPIRY_MS, mid]);

  const fetchProducts = useCallback(
    async (opts: FetchOptions = {}) => {
      const { bypassCache = false, showLoader = false } = opts;

      if (loading) return;

      // If we already have products and caller didn't request server refresh,
      // bail early (unless bypassCache is forcing a refetch).
      if (!bypassCache && products && !serverRefresh) return;

      // Cache hit? Only if not bypassing cache
      if (!bypassCache && loadFromCache()) return;

      if (showLoader) setLoader({ active: true });
      setLoading(true);
      try {
        // For storefront views, scope to the current merchant (mid).
        // For admin / global views (showAll === true), request all merchants
        // by omitting the mid parameter entirely so the backend is not pre-filtered.
        const requestParams: Record<string, any> = { limit };
        if (!showAll) {
          requestParams.mid = mid;
          requestParams.active = true;
        }

        const response = await productService.getProducts(requestParams);
        if (response?.data) {
          const payload = {
            object: response.object,
            data: response.data,
            has_more: response.has_more,
            live_mode: response.live_mode,
            created: Date.now(),
          };

          let list = payload.data as IProduct[];
          if (!showAll) list = merchantProductFilter(activeFilter(list));
          if (filters.length) list = applyFilters(list, filters);

          // Apply search and filters from state
          list = applySearch(list, searchQuery);
          list = applyCategoryFilter(list, categoryFilter);
          list = applyPriceFilter(list, priceRange);

          setRawProducts(list);
          setProducts(list);
          setTotal(list.length);
          // Only show "Load More" if backend says has_more AND we're showing fewer items than requested
          const shouldShowMore = Boolean(payload.has_more) && list.length >= limit;
          setHasMore(shouldShowMore);
          setLiveMode(payload.live_mode as boolean | undefined);

          setSessionItem("products", payload, { expiryMs: EXPIRY_MS });
        }
      } catch (err) {
        console.error(err);
        const apiErr = err as ApiError | undefined;
        const messageParts: string[] = [];

        if (apiErr?.message) {
          messageParts.push(apiErr.message);
        } else {
          messageParts.push("Failed to fetch services.");
        }

        if (apiErr?.status) {
          messageParts.push(`(status ${apiErr.status})`);
        }

        setError(messageParts.join(" "));
      } finally {
        if (showLoader) setLoader({ active: false });
        setLoading(false);
      }
    },
    [
      loading,
      products,
      serverRefresh,
      loadFromCache,
      filters,
      applyFilters,
      applySearch,
      applyCategoryFilter,
      applyPriceFilter,
      searchQuery,
      categoryFilter,
      priceRange,
      mid,
      setLoader,
      showAll,
      productService,
      EXPIRY_MS,
      limit,
      setSessionItem,
      merchantProductFilter,
      activeFilter,
    ]
  );

  // Re-fetch when search or filters change
  useEffect(() => {
    if (!rawProducts) return;
    let list = [...rawProducts];
    list = applySearch(list, searchQuery);
    list = applyCategoryFilter(list, categoryFilter);
    list = applyPriceFilter(list, priceRange);
    setProducts(list);
    setTotal(list.length);
  }, [
    rawProducts,
    searchQuery,
    categoryFilter,
    priceRange,
    applySearch,
    applyCategoryFilter,
    applyPriceFilter,
  ]);

  useEffect(() => {
    // If already hydrated, skip.
    if (products || sessionData === undefined) return;

    if (loadFromCache()) return;
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData !== undefined]);

  // Extract unique categories from products
  const categories = Array.from(
    new Set(
      products?.map((p) => p.metadata?.category).filter(Boolean) || []
    )
  );

  return {
    products,
    current,
    setCurrent,
    loading,
    liveMode,
    hasMore,
    error,
    // NOTE: now accepts options like { bypassCache: true }
    fetchProducts,
    total,
    filters,
    setFilters,
    // Search and filter controls
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    priceRange,
    setPriceRange,
    categories,
  };
};
