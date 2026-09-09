
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import styles from "./ProductsListing.scss";

import ProductListingItem from "../views/ProductListingItem/ProductListingItem";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import { IProduct } from "~/src/models/Shopping/IProduct";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import useRoute from "~/src/core/authentication/hooks/useRoute";
import capitalize from "@webstack/helpers/Capitalize";
import UiSliderLayout from "~/src/webstack/layouts/UiSliderLayout/controller/UiSliderLayout";
import useWindow from "@webstack/hooks/window/useWindow";
import UiSnapPageLayout from "@webstack/layouts/UiSnapPageLayout/UiSnapPageLayout";
import ProductCarousel from "../views/ProductCarousel/ProductCarousel";
import ProductListingHeader from "../views/ProductListingHeader/ProductListingHeader";
import getActiveProducts from "../functions/getActiveProducts";
import AdaptGrid from "@webstack/components/Containers/AdaptGrid/AdaptGrid";
import UiLoader from "@webstack/components/UiLoader/view/UiLoader";

type LayoutKey = "grid" | "list" | "gridX";
export type IProductListingVariant = "full-width" | "full" | "description" | "listing" | "carousel" | "view";
export interface IProductListing {
  hide?: string[] | "header";
  variant?: IProductListingVariant;
  scrollX?: boolean;
  products?: IProduct[] | null;
  hasMore: boolean;
  loading: boolean;
  error?: string;
  onSelect?: (e: any) => void;
  showLayoutSelector?: boolean;
  // Search and filter props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  categoryFilter?: string | null;
  onCategoryChange?: (category: string | null) => void;
  categories?: string[];
  priceRange?: { min?: number; max?: number };
  onPriceRangeChange?: (range: { min?: number; max?: number }) => void;
}

const PLACEHOLDER_COUNT = 7;

const isLayoutKey = (v: any): v is LayoutKey =>
  v === "grid" || v === "list" || v === "gridX";

const ProductsListing = ({
  hide,
  variant,
  onSelect,
  scrollX,
  products,
  hasMore,
  loading,
  error,
  showLayoutSelector = false,
  searchQuery = "",
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  categories = [],
  priceRange,
  onPriceRangeChange,
}: IProductListing) => {
  const router = useRouter();
  const { query, pathname } = router;
  const { routeTitle } = useRoute();
  const { width } = useWindow();
  // const useSnapLayout = width < 1100 && variant !== "view" && variant !== "carousel";
  // const [snapIndex, setSnapIndex] = useState(0);

  // Normalize query.layout to string then guard it
  const qLayout = Array.isArray(query.layout) ? query.layout[0] : query.layout;
  const initialLayout: LayoutKey = isLayoutKey(qLayout) ? qLayout : "grid";
  const [productsView, setProductsView] = useState<LayoutKey>(initialLayout);

  const layoutList: LayoutKey[] = useMemo(() => ["grid", "list"], []);
  const layouts: Record<LayoutKey, any> = useMemo(
    () => ({
      grid: { gap: 10, xs: 1,sm: variant === 'view' ? 2 : 1, md: 3, lg: 4, xl: 3, xxl: 1, variant },
      gridX: { gap: 10, sm: 3, md: 3, lg: 3, xl: 5, scroll: "scroll-x" },
      list: { gap: 10, xs: 1 },
    }),
    [variant],
  );

  const isHideHeader = Array.isArray(hide) ? hide.includes("header") : hide === "header";
  const activeProducts = getActiveProducts(products);
  const hasProducts = activeProducts.length > 0;
  const useSliderLayout = typeof hide === "undefined";

  const handleLayoutChange = (newLayout: LayoutKey) => {
    if (onSelect) return onSelect(newLayout);
    setProductsView(newLayout);
    router.push({ pathname, query: { ...query, layout: newLayout } }, undefined, { shallow: true });
  };

  const viewConditions = {
    header: !isHideHeader && variant !== "description",
    body: hasProducts || loading,
    footer: (hasMore && hasProducts && !loading) && variant !== "description",
  };

  useEffect(() => {
    if (scrollX) handleLayoutChange("gridX");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titleText = hasProducts && !products?.length ? `Unable to find any ${routeTitle || "products"}`:routeTitle ? capitalize(routeTitle) : "products";

  // ── Shared props for ProductListingHeader ─────────────────────────────
  const layoutOptions = layoutList.map((view) => ({ name: view, value: view, label: view }));
  const headerProps = {
    title: titleText,
    productCount: products?.length || 0,
    showLayoutSelector,
    layoutValue: productsView,
    layoutOptions,
    onLayoutChange: (v: any) => handleLayoutChange(v as LayoutKey),
    searchQuery,
    onSearchChange,
    categoryFilter,
    onCategoryChange,
    categories,
    priceRange,
    onPriceRangeChange,
  };

  // ── Shared snap header & footer ───────────────────────────────────────
  const snapHeader = viewConditions.header ? (
    <ProductListingHeader {...headerProps} compact />
  ) : undefined;

  const snapFooter = viewConditions.footer ? (
    <div className="products-listing__footer">
      <div><UiButton>Load More</UiButton></div>
    </div>
  ) : undefined;

  // ── Render product grid (shared between slider & non-slider paths) ───
  const renderGrid = () => {
    const showSkeletons = loading || !hasProducts;

    return (
      <>
        <style jsx>{styles}</style>
        <AdaptGrid {...layouts[productsView]}>
          {showSkeletons
            ? Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
              <div
              key={`ph-${i}`}
              className="products-listing__item-container products-listing__item-skeleton"
              aria-busy={loading || undefined}
              />
            ))
            : activeProducts.map((product, key) => (
              <div
              key={product.id ? `${product.id}+${key}` : key}
              className="products-listing__item-container"
              >
                <ProductListingItem
                  variant={variant}
                  onSelect={onSelect}
                  product={product}
                  layout={layouts[productsView]}
                  />
              </div>
            ))}
        </AdaptGrid>
      </>
    );
  };

  // ── Body content (carousel, grid, or empty) ──────────────────────────
  const renderBody = () => {
    if (variant === "carousel") {
      return (
        <ProductCarousel
          products={products}
          loading={loading}
          layout={layouts[productsView]}
          onSelect={onSelect}
          error={error}
          title={titleText}
        />
      );
    }

    const productsResolved = Array.isArray(products);
    if (hasProducts || loading || !productsResolved) {
      return <>
        <style jsx>{styles}</style>
        <div className="products-listing__body">{renderGrid()}</div>
      </>
    }

    return <>
      <style jsx>{styles}</style>
      <div className="products-listing">
        <div className="products-listing__empty"><UiLoader text={titleText} dots={hasProducts} /></div>
      </div>
      </>;
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="products-listing">
        {useSliderLayout ? (
          <UiSliderLayout
            storageKey="products-listing:panel"
            initialWidth={420}
            minWidth={320}
            renderMobileToggle={(state) => (
              <div className="products-listing__mobile-header">
                <h1>
                  {titleText}{" "}
                  <small className="products-listing__count">
                    showing: {products?.length || 0}
                  </small>
                </h1>
                <UiIcon
                  onClick={state.togglePanel}
                  aria-label="Toggle filters panel"
               icon="fa-gear" />
              </div>
            )}
            renderPanel={() =>
              viewConditions.header ? <ProductListingHeader {...headerProps} /> : null
            }
            renderContent={() => (
              <>
                {renderBody()}
                {viewConditions.footer && (
                  <div className="products-listing__footer">
                    <div><UiButton>Load More</UiButton></div>
                  </div>
                )}
              </>
            )}
          />
        ) : (
          <>
            {viewConditions.header && <ProductListingHeader {...headerProps} />}
            {renderBody()}
            {viewConditions.footer && (
              <div className="products-listing__footer">
                <div><UiButton>Load More</UiButton></div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default ProductsListing;
