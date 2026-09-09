import React from "react";
import styles from "./ProductCarousel.scss";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import { IProduct } from "~/src/models/Shopping/IProduct";
import ProductListingItem from "../ProductListingItem/ProductListingItem";
import useCarouselScroll from "../../hooks/useCarouselScroll";
import getActiveProducts from "../../functions/getActiveProducts";
import { IProductListingVariant } from "../../controller/ProductsListing";
import UiLoader from "@webstack/components/UiLoader/view/UiLoader";

const PLACEHOLDER_COUNT = 3;

export interface IProductCarousel {
    products: IProduct[] | null | undefined;
    loading: boolean;
    layout: Record<string, any>;
    onSelect?: (product: any) => void;
    error?: string;
    title?: string;
}

const ProductCarousel: React.FC<IProductCarousel> = ({
    products,
    loading,
    layout,
    onSelect,
    error,
    title,
}) => {
    const activeProducts = getActiveProducts(products);
    const hasProducts = activeProducts.length > 0;
    const {
        carouselRef,
        canScrollLeft,
        canScrollRight,
        scrollLeft,
        scrollRight,
        pauseAuto,
        resumeAuto,
    } = useCarouselScroll(true, [activeProducts.length], { autoScroll: true });

    const showSkeletons = loading || !hasProducts;

    return (
        <>
            <style jsx>{styles}</style>
            <div
                className="product-carousel"
                onMouseEnter={pauseAuto}
                onMouseLeave={resumeAuto}
                onTouchStart={pauseAuto}
                onTouchEnd={resumeAuto}
            >
                {canScrollLeft && hasProducts && (
                    <div
                        className="product-carousel__arrow product-carousel__arrow--left"
                        onClick={scrollLeft}
                        role="button"
                        aria-label="Scroll left"
                    >
                        <UiIcon icon="fa-chevron-left" />
                    </div>
                )}

                <div className="product-carousel__track" ref={carouselRef}>
                    {showSkeletons
                        ? Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
                            <div
                                key={`cph-${i}`}
                                className="product-carousel__item product-carousel__item--skeleton"
                                aria-busy={loading || undefined}
                            />
                        ))
                        : activeProducts.map((product, idx) => (
                            <div
                                key={product.id ? `${product.id}+${idx}` : idx}
                                className="product-carousel__item"
                            >
                                <ProductListingItem
                                    variant={"carousel" as IProductListingVariant}
                                    onSelect={onSelect}
                                    product={product}
                                    layout={layout}
                                />
                            </div>
                        ))}
                </div>

                {!loading && !hasProducts && (
                    <div className="product-carousel__empty">
                              <div className="products-listing__empty"><UiLoader
                               text={title} dots={hasProducts&&"no products"} /></div>
                    </div>
                )}

                {canScrollRight && hasProducts && (
                    <div
                        className="product-carousel__arrow product-carousel__arrow--right"
                        onClick={scrollRight}
                        role="button"
                        aria-label="Scroll right"
                    >
                        <UiIcon icon="fa-chevron-right" />
                    </div>
                )}
            </div>
        </>
    );
};

export default ProductCarousel;
