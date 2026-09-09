import React, { useEffect, useState } from "react";
import styles from "./ProductDescription.scss";
import AdaptGrid from "@webstack/components/Containers/AdaptGrid/AdaptGrid";
import UiLoader from "@webstack/components/UiLoader/view/UiLoader";
import ProductBuyNow from "../views/ProductBuyNow/ProductBuyNow";
import useCart from "~/src/modules/ecommerce/cart/hooks/useCart";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import environment from "~/src/core/environment";
import UiMedia from "@webstack/components/UiMedia/controller/UiMedia";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import { IProduct } from "~/src/models/Shopping/IProduct";
import { useRouter } from "next/router";
import UiMarkdown from "@webstack/components/UiMarkDown/controller/UiMarkDown";
import keyStringConverter from "@webstack/helpers/keyStringConverter";

interface IProductDescription {
  btnText?: string;
  current?: IProduct;
  variant?: 'listing' | '';
  setCurrent?: (e?: any | null) => void;
}

const ProductDescription: React.FC<IProductDescription> = ({ btnText, current, setCurrent, variant }) => {
  const router = useRouter();
  const productNonExist = "product does not exist";
  const { cart } = useCart();
  const { isModalOpen, openModal, closeModal } = useModal();
  const { query } = useRouter();
  const queryPriceId = query?.pri;
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [imageList, setImageList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean | string>(true);
  const isCurrentlySelected = variant !== 'listing';
  const handleBack = () => {
    setCurrent?.(undefined);
    router.push(router.pathname, undefined, { shallow: false });
  }
  // ✅ hydrate whenever `current` changes
  useEffect(() => {

    if (!current) {
      setIsLoading(true);
      setMainImage(null);
      setImageList([]);
      return;
    }
    const hydrated: IProduct & { price?: any } = { ...current };
    if (hydrated?.price && typeof hydrated.price === "object") {
      hydrated.price = { ...hydrated.price, qty: hydrated.price?.qty ?? 0 };
    }

    // Determine which price's images to prioritize.
    // Only let the URL param override when we're in the full description view;
    // listing tiles should always display their own variant imagery.
    const pricesArray: any[] = Array.isArray((hydrated as any).prices)
      ? ((hydrated as any).prices as any[])
      : [];

    const shouldUseQueryPrice = isCurrentlySelected && !!queryPriceId && pricesArray.length > 0;

    const activePrice =
      (shouldUseQueryPrice
        ? pricesArray.find((p) => String(p?.id) === String(queryPriceId))
        : null) ||
      hydrated.price;

    // Extract price images from metadata (img_1, img_2, etc.)
    const priceImages: string[] =
      activePrice && activePrice.metadata
        ? Object.entries(activePrice.metadata)
          .filter(([key, value]) => key.startsWith("img_") && typeof value === "string" && value)
          .sort(([a], [b]) => {
            const numA = parseInt(a.replace('img_', ''), 10);
            const numB = parseInt(b.replace('img_', ''), 10);
            return numA - numB;
          })
          .map(([, value]) => value as string)
        : [];

    const productImages: string[] = Array.isArray(hydrated.images)
      ? hydrated.images.filter((src: any) => typeof src === "string" && src)
      : [];

    // Prioritize price images over product images
    const combined = [...priceImages, ...productImages].filter(
      (src, idx, arr) => arr.indexOf(src) === idx,
    );

    if (combined.length > 0) {
      setImageList(combined);
      setMainImage(combined[0]);
      setIsLoading(false);
    } else {
      setImageList([]);
      setMainImage(null);
      setIsLoading("No images available");
    }
  }, [current, queryPriceId, isCurrentlySelected]);

  const nameMaker = (stringTitle: any) => {
    if (stringTitle && typeof stringTitle !== "string") return;
    if (stringTitle?.includes("_")) return keyStringConverter(stringTitle, { textTransform: "uppercase" });
    return stringTitle;
  };
  const handleImageClick = (main?: boolean, src?: string) => {
    if (!src || !isCurrentlySelected) return;
    if (main) {
      openModal({
        variant: "popup", children: <>
          <div style={{
            aspectRatio: 1
          }}>

            <UiMedia src={src} alt="product main image" />
          </div>
        </>
      });
      return;
    }
    setMainImage(src);
    if (isModalOpen) closeModal();
  };

  if (!current) {
    return (
      <>
        <style jsx>{styles}</style>
        <div className="product-description">
          <div className="product-description--loader">
            <UiLoader text={isLoading ? "loading product…" : productNonExist} dots={isLoading === true} />
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <style jsx>{styles}</style>
      <div
        className={`product-description ${variant ? `product-description--${variant}` : ""}${current?.price?.id == queryPriceId && variant == 'listing' ? " product-description--active" : ""
          }
        `}
      >
        {!variant && (
          <div className="product-description__back"  >

            <UiButton traits={{ beforeIcon: "fa-chevron-left" }} variant="link" onClick={handleBack}>
              BACK TO SHOP
            </UiButton>

          </div>
        )}

        <div className="product-description__body">
          <div className={`product-description__body--list ${isCurrentlySelected
            ? "product-description__body--list__current" : "" }`}>
            <div className={`product-description__images  ${variant ? `product-description__images--${variant}` : ""}`}>
              {mainImage ? (
                <>
                  <div className={`product-description__images--main ${isCurrentlySelected
                    ?"product-description__images--main__current":""
                  }`} onClick={() => isCurrentlySelected && handleImageClick(true, mainImage)}>
                    <UiMedia
                      src={mainImage}
                      alt={current.name}
                      type="image"
                      loadingText={variant === 'listing' ? " " : "Loading image..."}
                    // variant={variant === 'listing' ? undefined : 'thumbnail'}
                    />
                  </div>
                  {isCurrentlySelected && imageList.length > 1 && (
                    <AdaptGrid xs={3} sm={4} md={20} gap={5} scroll="scroll-x">
                      {imageList.map((image: string, index: number) => (
                        <div
                          key={index}
                          onClick={() => handleImageClick(false, image)}
                          className={`product-description__images--carousel__item ${mainImage === image ? "product-description__images--carousel__item--active" : ""
                            }`}
                        >
                          <UiMedia src={image} variant="carousel" alt={current.name} />
                        </div>
                      ))}
                    </AdaptGrid>
                  )}
                </>
              ) : (
                  <div className={`product-description__images--main ${isCurrentlySelected
                    ? "product-description__images--main__current" : ""
                    }`}>
                  <UiIcon icon={`${environment.merchant.name}-logo`} />
                </div>
              )}
            </div>

            <div className={`product-description__info-panel ${current?.price?.id !== queryPriceId ? "panel-listing" : "panel-current"}`}>
              <div className="product-description__info-panel_header">
                <div className="product-description__info-panel_title">{
                  isCurrentlySelected ? nameMaker(current.name) : current?.price?.nickname ? nameMaker(current?.price?.nickname) : !isCurrentlySelected ? nameMaker(current.name) : current?.price?.nickname && nameMaker(current?.price?.nickname)
                }

                </div>

              </div>
              {isCurrentlySelected && current?.description && (
                <div className="product-description__info-panel_body">
                  <UiMarkdown text={current.description} />
                </div>
              )}

              <div className="product-description__footer">
                {cart && cart.length >= 1 && (
                  <div className="product-description__go-to-cart">
                    <UiButton
                      // label={current?.price?.nickname}
                      traits={{ afterIcon: "fal-bag-shopping" }} variant="link" href="/cart">
                      go to cart
                    </UiButton>
                  </div>
                )}
                <div className="product-description__buy-button">
                  <ProductBuyNow size={isCurrentlySelected && "xl" || undefined} goToCart product={current} btnText={btnText} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default ProductDescription;
