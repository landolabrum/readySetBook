import { IProduct } from "~/src/models/Shopping/IProduct";

/**
 * Filters a product list to only active entries.
 * Returns an empty array when products is null/undefined.
 */
const getActiveProducts = (products: IProduct[] | null | undefined): IProduct[] => {
    if (!Array.isArray(products)) return [];
    return products.filter((p) => p?.active !== false);
};

export default getActiveProducts;
