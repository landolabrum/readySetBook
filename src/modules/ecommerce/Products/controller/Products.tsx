// ServicesPage.tsx
import React, { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useRouter } from "next/router";
import styles from "./Products.scss";
import AdaptGrid from "@webstack/components/Containers/AdaptGrid/AdaptGrid";
import useRoute from "~/src/core/authentication/hooks/useRoute";
import capitalize from "@webstack/helpers/Capitalize";
import { useProducts } from "../hooks/useProducts";
import { IProduct } from "~/src/models/Shopping/IProduct";
import ProductsListing from "../views/ProductListing/controller/ProductsListing";
import { useNotification } from "@webstack/components/Notification/Notification";
import { getSimilarProducts } from "../utils/getSimilarProducts";
import ProductDescription from "../views/ProductDescription/controller/ProductDescription";


export interface IServicesPage {
  hide?: string[] | "header";
  variant?: "full-width" | "full" | "description" | "listing" | "view" | "carousel";
  scrollX?: boolean;
  showLayoutSelector?: boolean;
  onSelect?: (_: any) => void;
}

const PLACEHOLDER_COUNT = 3;

const ProductsPage: React.FC<IServicesPage> = ({ hide, variant }) => {
  const router = useRouter();
  const { isReady, query } = router;
  const navRef = useRef(false); // suppress sync while we navigate
  const [limit] = useState<number | undefined>(undefined);

  const { routeTitle } = useRoute();
  const {
    products,
    current,
    setCurrent,
    loading,
    hasMore,
    error,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    categories,
    priceRange,
    setPriceRange,
  } = useProducts({ limit, });
  const [, setNotification] = useNotification();

  // ✅ read params from router.query (source of truth)
  const qId = useMemo(() => (typeof query?.id === "string" ? query.id : undefined), [query?.id]);
  const qPri = useMemo(() => (typeof query?.pri === "string" ? query.pri : undefined), [query?.pri]);

  // Flatten products so each price appears as its own listing entry
  const listings: IProduct[] = useMemo(() => {
    if (!Array.isArray(products)) return [];

    return products.flatMap((p: any) => {
      const base = p as IProduct & { prices?: any[] };

      if (Array.isArray((base as any).prices) && (base as any).prices.length > 0) {
        return (base as any).prices.map((price: any) => ({
          ...base,
          price,
        }));
      }

      return [base];
    });
  }, [products]);

  const isHideHeader = Array.isArray(hide) ? hide.includes("header") : hide === "header";
  const hasProducts = Array.isArray(listings) && listings.length > 0;
  const titleText = routeTitle ? capitalize(routeTitle) : "Services";

  // Surface backend errors to the user via global notification
  useEffect(() => {
    if (!error) return;
    setNotification({
      active: true,
      dismissable: true,
      apiError: {
        message: error,
        status: 500,
        detail: { context: "services" },
        error: true,
      },
    });
  }, [error, setNotification]);

  // Sync URL -> state (never clear on missing qId; just wait)
  useEffect(() => {
    if (!isReady || navRef.current) return;
    if (!qId || !products?.length) return;

    const match = products.find((p) => String(p.id) === String(qId));
    if (match) {
      // Start from the full product object returned by the API
      let next: IProduct = match as IProduct;

      // If a price id is specified, prefer that price when hydrating `current`
      if (qPri && Array.isArray((match as any).prices)) {
        const pri = (match as any).prices.find((pr: any) => String(pr?.id) === String(qPri));
        if (pri) {
          next = { ...(match as any), price: pri } as IProduct;
        }
      }

      if (
        !current ||
        String(current.id) !== String(next.id) ||
        current.price?.id !== next.price?.id
      ) {
        setCurrent?.(next);
      }
    }
  }, [isReady, products, qId, qPri, setCurrent]);

  // Navigate + pin params to address bar
  const goToProduct = useCallback(
    async (p: IProduct) => {
      if (!p?.id) return;

      const primaryPri = (p as any)?.price?.id;

      setCurrent?.(p);

      const qs = new URLSearchParams({ id: String(p.id) });
      if (primaryPri) qs.set("pri", String(primaryPri));
      const href = `/services?${qs.toString()}`;

      try {
        navRef.current = true;
        // use string form to force what appears in the bar
        await router.replace(href, href, { shallow: false, scroll: true });
      } finally {
        // let router.query settle before effects can read it
        setTimeout(() => (navRef.current = false), 0);
      }
    },
    [router, setCurrent]
  );

  // Grid
  const gridProps = useMemo(
    () => ({ gap: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }),
    []
  );

  // Get similar products when a product is selected
  const similarProducts = useMemo(() => {
    if (!current || !listings.length) return [];
    return getSimilarProducts({
      current,
      allProducts: listings,
      limit: 9,
    });
  }, [current, listings]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className={`products ${variant ? `products--${variant}` : ""}`}>
        {/* {!current && !isHideHeader && (
          <div className='products__header'>
            {keyStringConverter(environment.merchant.name, { textTransform: "uppercase" })} Packages & Services
          </div>
        )} */}
        <div className="products__content">
          {current && <ProductDescription current={current} setCurrent={setCurrent} />}
          {/* Use ProductsListing with search and filters when no product is selected */}
          {!current && (
            <ProductsListing
              products={listings}
              loading={loading}
              hasMore={hasMore}
              error={error || undefined}
              variant={variant}
              hide={hide}
              onSelect={goToProduct}
              showLayoutSelector={false}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              categories={categories}
              priceRange={priceRange}
              onPriceRangeChange={setPriceRange}
            />
          )}

          {/* Show related services when a product is selected */}
          {current && similarProducts.length > 0 && (
            <div className="products-listing">
              <div className="products-listing__header">
                Recommended
              </div>
              <section className="products-listing__body">
                <AdaptGrid {...gridProps}>
                  {similarProducts.map((product: any, i: number) => {
                    const key = `${product?.id}+${product?.price?.id}+${i}`;
                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        onClick={() => goToProduct(product as IProduct)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            goToProduct(product as IProduct);
                          }
                        }}
                      >
                        <ProductDescription current={product} variant="listing" />
                      </div>
                    );
                  })}
                </AdaptGrid>
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProductsPage;
