import styles from "./ProductListingItem.scss";
import { useRef, useState } from "react";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import environment from "~/src/core/environment";
import ProductBuyNow from "../../../ProductDescription/views/ProductBuyNow/ProductBuyNow";
import { useRouter } from "next/router";
import { MerchantSettingsLayout } from "~/src/core/environments/environment.interface";
import UiMedia from "@webstack/components/UiMedia/controller/UiMedia";
import { IProduct } from "~/src/models/Shopping/IProduct";
import { IProductListingVariant } from "../../controller/ProductsListing";
import keyStringConverter from "@webstack/helpers/keyStringConverter";
interface IProductListingItem {
  product: IProduct;
  variant?: IProductListingVariant;
  layout: MerchantSettingsLayout;
  onSelect?: (e: any) => void;
}

const ProductListingItem = ({ product, variant, layout, onSelect }: IProductListingItem) => {
  const router = useRouter();
  const { push, query, } = router;
  const [isHoveringBuyNow, setIsHoveringBuyNow] = useState(false);
  const cardRef = useRef<any>(null);

  const handleProductDescription = () => {
    if (isHoveringBuyNow) return;

    if (onSelect) {
      // Let parent handle routing/state hydration so it has the full product payload
      return onSelect(product);
    }

    // const newQuery = {
    //   ...query,
    //   id: product.id,
    //   pri: product.price.id,
    // };
    window.location.href = `/product?id=${product.id}&pri=${product.price.id}`;
    // push({ pathname: '/product', query: newQuery }, `/product?id=${product.id}&pri=${product.price.id}`);
  };
  // const mappedPrice = product?.prices?.length ? product.prices : [product?.price];
  const mappedPrice = [product?.price];
  if (!product) return <div>product not loaded</div>;

  // Extract first image from price metadata or fallback to product images
  const getFirstImage = () => {
    // Try price metadata first
    if (product?.price?.metadata) {
      const priceImages = Object.entries(product.price.metadata)
        .filter(([key, value]) => key.startsWith('img_') && typeof value === 'string' && value)
        .sort(([a], [b]) => {
          const numA = parseInt(a.replace('img_', ''), 10);
          const numB = parseInt(b.replace('img_', ''), 10);
          return numA - numB;
        })

        .map(([, value]) => value as string);
      if (priceImages.length > 0) return priceImages[0];
    }
    // Fallback to product images
    if (product?.images?.length > 0) return product.images[0];
    return null;
  };

  const firstImage = getFirstImage();

  const handleBuyNowMouseEnter = () => setIsHoveringBuyNow(true);
  const handleBuyNowMouseLeave = () => setIsHoveringBuyNow(false);


  return (
    <>
      <style jsx>{styles}</style>
      <div
        ref={cardRef}
        className={`product-listing-item product-listing-item__${layout?.layoutStyle || query?.layout || "grid"} ${layout?.size || ""
          } ${variant ? `product-listing-item__${variant}` : ""}`}
        onClick={handleProductDescription}
      >
        {/* Image layer - fills entire card */}
        <div className={`product-listing-item--images ${variant ? `product-listing-item--images__${variant}` : ""}`}>
          {firstImage ? (
            <UiMedia loadingText=" " src={firstImage} alt={product?.name} type="image" />
          ) : (
            <div className="product-listing-item--images--placeholder">
              <UiIcon icon={environment.merchant.name + "-logo"} />
            </div>
          )}
        </div>

        {/* Overlay layer - product name and CTA at bottom */}
        <div className="product-listing-item__overlay">
          <div className="product-listing-item--bg-primary">{product?.name}</div>
          <div className="product-listing-item__price">
            {mappedPrice.map((price: any, idx: number) => (
              <div key={idx} className="product-listing-item__price--item"
                onMouseEnter={handleBuyNowMouseEnter} onMouseLeave={handleBuyNowMouseLeave}
              >

                {price?.unit_amount !== 0 && (
                  <ProductBuyNow
                    goToCart
                    btnText={keyStringConverter(
                      `${price?.nickname ? price.nickname + " | " : ""} ${product?.name}`, {
                      textTransform: "capitalize"
                    }
                    )}
                    // size="sm"
                    variant="inherit"
                    product={{ ...product, price }}
                  />
                )}

              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductListingItem;
