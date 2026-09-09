import { IProduct } from "~/src/models/Shopping/IProduct";

interface ISimilarProductsOptions {
  current: IProduct;
  allProducts: IProduct[];
  limit?: number;
}

/**
 * Gets similar products based on:
 * 1. Same product ID (different prices/variants)
 * 2. Same category
 * 3. Similar features
 */
export function getSimilarProducts({
  current,
  allProducts,
  limit = 9,
}: ISimilarProductsOptions): IProduct[] {
  if (!current || !Array.isArray(allProducts)) return [];

  const currentId = String(current.id);
  const currentPriceId = String(current.price?.id);
  const currentCategory = current.metadata?.category || (current as any).metadata?.["metadata.category"];
  const currentFeatures = Array.isArray(current.features) ? current.features : [];

  // Helper to check if two products are the same (same ID and price)
  const isSameProduct = (p: IProduct) => {
    return String(p.id) === currentId && String(p.price?.id) === currentPriceId;
  };

  // 1. Same product ID (different price variants) - first 3
  const sameProductVariants = allProducts
    .filter((p) => {
      return (
        p?.active !== false &&
        p?.price?.active !== false &&
        String(p.id) === currentId &&
        String(p.price?.id) !== currentPriceId
      );
    })
    .slice(0, 3);

  // 2. Same category - next 3
  const sameCategory = allProducts
    .filter((p) => {
      if (isSameProduct(p)) return false;
      if (String(p.id) === currentId) return false; // Skip same product
      if (p?.active === false || p?.price?.active === false) return false;
      
      const pCategory = p.metadata?.category || (p as any).metadata?.["metadata.category"];
      return currentCategory && pCategory && pCategory === currentCategory;
    })
    .slice(0, 3);

  // 3. Similar features - next 3
  const similarFeatures = allProducts
    .filter((p) => {
      if (isSameProduct(p)) return false;
      if (String(p.id) === currentId) return false; // Skip same product
      if (p?.active === false || p?.price?.active === false) return false;
      
      // Skip if already in sameCategory
      const pCategory = p.metadata?.category || (p as any).metadata?.["metadata.category"];
      if (currentCategory && pCategory && pCategory === currentCategory) return false;

      // Check feature overlap
      const pFeatures = Array.isArray(p.features) ? p.features : [];
      if (currentFeatures.length === 0 || pFeatures.length === 0) return false;

      const overlap = currentFeatures.filter((f) => pFeatures.includes(f));
      return overlap.length > 0;
    })
    .sort((a, b) => {
      // Sort by number of matching features (descending)
      const aFeatures = Array.isArray(a.features) ? a.features : [];
      const bFeatures = Array.isArray(b.features) ? b.features : [];
      
      const aOverlap = currentFeatures.filter((f) => aFeatures.includes(f)).length;
      const bOverlap = currentFeatures.filter((f) => bFeatures.includes(f)).length;
      
      return bOverlap - aOverlap;
    })
    .slice(0, 3);

  // Combine all three groups
  const combined = [
    ...sameProductVariants,
    ...sameCategory,
    ...similarFeatures,
  ];

  // If we don't have enough, fill with random products
  if (combined.length < limit) {
    const remaining = allProducts
      .filter((p) => {
        if (isSameProduct(p)) return false;
        if (p?.active === false || p?.price?.active === false) return false;
        return !combined.find((c) => String(c.id) === String(p.id) && String(c.price?.id) === String(p.price?.id));
      })
      .slice(0, limit - combined.length);
    
    combined.push(...remaining);
  }

  return combined.slice(0, limit);
}
