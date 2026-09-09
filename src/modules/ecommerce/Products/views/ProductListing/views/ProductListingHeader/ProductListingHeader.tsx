import React from "react";
import styles from "./ProductListingHeader.scss";
import UiSelect from "@webstack/components/UiForm/components/UiSelect/UiSelect";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";

export interface IProductListingHeader {
    title: string;
    productCount: number;
    /** Layout selector */
    showLayoutSelector?: boolean;
    layoutValue?: string;
    layoutOptions?: { name: string; value: string; label: string }[];
    onLayoutChange?: (value: any) => void;
    /** Search */
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    /** Category filter */
    categoryFilter?: string | null;
    onCategoryChange?: (category: string | null) => void;
    categories?: string[];
    /** Price range filter */
    priceRange?: { min?: number; max?: number };
    onPriceRangeChange?: (range: { min?: number; max?: number }) => void;
    /** When true only renders the title row (no search/filters). */
    compact?: boolean;
}

const ProductListingHeader: React.FC<IProductListingHeader> = ({
    title,
    productCount,
    showLayoutSelector = false,
    layoutValue,
    layoutOptions,
    onLayoutChange,
    searchQuery = "",
    onSearchChange,
    categoryFilter,
    onCategoryChange,
    categories = [],
    priceRange,
    onPriceRangeChange,
    compact = false,
}) => {
    const hasActiveFilters = !!(categoryFilter || priceRange?.min || priceRange?.max);

    return (
        <>
            <style jsx>{styles}</style>
            <div className="product-listing-header">
                {/* <div className="product-listing-header__top">
                    <h1>
                        <small className="product-listing-header__count">
                            showing: {productCount}
                        </small>
                    </h1>
                    {showLayoutSelector && layoutOptions && onLayoutChange && (
                        <div className="product-listing-header__layout-actions">
                            <UiSelect
                                // variant="flat"
                                value={layoutValue}
                                options={layoutOptions}
                                onSelect={(a) => onLayoutChange(a.value)}
                            />
                        </div>
                    )}
                </div> */}

                {!compact && (
                    <div className="product-listing-header__controls">
                        <div className="product-listing-header__search">
                            <UiInput
                                // variant="flat"
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange?.(e.target.value)}
                                traits={{
                                    beforeIcon: "fa-magnifying-glass",
                                    afterIcon: searchQuery
                                        ? {
                                            icon: "fa-xmark",
                                            onClick: () => onSearchChange?.(""),
                                        }
                                        : undefined,
                                }}
                            />
                        </div>

                        <div className="product-listing-header__filters">
                            {categories.length > 0 && (
                                <UiSelect
                                    label="Category"
                                    // variant="flat"

                                    value={categoryFilter || "all"}
                                    options={[
                                        { label: "All Categories", value: "all" },
                                        ...categories.map((cat) => ({ label: cat, value: cat })),
                                    ]}
                                    onSelect={(opt) =>
                                        onCategoryChange?.(opt.value === "all" ? null : opt.value)
                                    }
                                    clearable
                                />
                            )}

                            {/* <div className="product-listing-header__price-filter"> */}
                                <UiInput
                                    // variant="flat"

                                    type="number"
                                    label="Min Price"
                                    placeholder="Min"
                                    value={priceRange?.min || ""}
                                    onChange={(e) =>
                                        onPriceRangeChange?.({
                                            ...priceRange,
                                            min: e.target.value
                                                ? Number(e.target.value)
                                                : undefined,
                                        })
                                    }
                                    traits={{ beforeIcon: "fa-dollar-sign" }}
                                />
                                <UiInput
                                    // variant="flat"
                                    type="number"
                                    label="Max Price"
                                    placeholder="Max"
                                    value={priceRange?.max || ""}
                                    onChange={(e) =>
                                        onPriceRangeChange?.({
                                            ...priceRange,
                                            max: e.target.value
                                                ? Number(e.target.value)
                                                : undefined,
                                        })
                                    }
                                    traits={{ beforeIcon: "fa-dollar-sign" }}
                                />
                            {/* </div> */}

                            {hasActiveFilters && (
                                <UiButton
                                    variant="link"
                                    onClick={() => {
                                        onCategoryChange?.(null);
                                        onPriceRangeChange?.({});
                                    }}
                                    traits={{ beforeIcon: "fa-filter-slash" }}
                                >
                                    Clear Filters
                                </UiButton>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default ProductListingHeader;
