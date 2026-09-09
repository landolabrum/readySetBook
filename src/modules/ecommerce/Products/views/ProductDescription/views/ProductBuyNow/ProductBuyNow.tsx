import React, { useEffect, useMemo, useState } from 'react';
import styles from './ProductBuyNow.scss';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiPill from '@webstack/components/UiForm/components/UiPill/UiPill';
import { dateFormat, numberToUsd } from '@webstack/helpers/userExperienceFormats';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
import useCart from '~/src/modules/ecommerce/cart/hooks/useCart';
import { ITraits } from '@webstack/components/UiForm/components/FormControl/FormControl';
import { IProduct } from '~/src/models/Shopping/IProduct';
import ContactForm from '@shared/components/Contact/forms/ContactForm/ContactForm';
import { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import environment from '~/src/core/environment';
import ContactUs from '@shared/components/Contact/forms/ContactUs/ContactUs';
import useUserPurchaseIntents from '~/src/core/services/MemberService/hooks/useUserPurchaseIntents';

export interface IProductBuyNow {
  product?: IProduct;
  traits?: ITraits;
  btnText?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  goToCart?: boolean;
  variant?: string;
}

const ProductBuyNow: React.FC<IProductBuyNow> = ({
  product,
  variant,
  traits,
  size,
  btnText,
  goToCart = false,
}) => {
  // Hooks MUST be first, always run, never behind a conditional
  const { addCartItem, cart } = useCart();
  const { openModal, closeModal, replaceModal } = useModal();
  const { getPurchaseFor } = useUserPurchaseIntents();

  const primaryPrice = useMemo(
    () =>
      product?.price ||
      (Array.isArray((product as any)?.prices) && (product as any).prices.length > 0
        ? (product as any).prices[0]
        : undefined),
    [product],
  );

  // Price label
  const [label, setLabel] = useState<string>('add');

  useEffect(() => {
    if (!product) {
      setLabel('add');
      return;
    }

    if (!btnText && !product?.metadata?.hide_price) {
      setLabel(
        primaryPrice?.unit_amount
          ? `${numberToUsd(primaryPrice.unit_amount)}${primaryPrice.recurring?.interval ? ' / ' + primaryPrice.recurring.interval : ''
          }`
          : '-'
      );
    } else {
      setLabel(!product?.active ? 'unavailable' : btnText || String(primaryPrice?.unit_amount_decimal ?? ''));
    }
  }, [product !== null, primaryPrice, btnText]);

  // Derived state from cart/product (safe even if product is undefined)
  const isDisabled =
    Boolean(primaryPrice?.active !== true) || Boolean(!product?.active || !primaryPrice?.id);
  // Prior purchase state: recurring prices can't be re-bought; one-time prices
  // show when they were last purchased but stay buyable.
  const purchase = getPurchaseFor(primaryPrice?.id);
  const isRecurring = Boolean(primaryPrice?.recurring?.interval);
  const purchasedRecurring = Boolean(purchase) && isRecurring;
  const lastPurchased =
    purchase && !isRecurring
      ? `Last Purchased ${dateFormat(purchase.created, { isTimestamp: true })}`
      : undefined;
  const cookieProduct: any =
    product && primaryPrice ? cart?.find((item: any) => item?.price?.id === primaryPrice.id) : null;
  const qty = cookieProduct?.price?.qty || 0;

  // Contact form fields
  const merchantName = environment.merchant.name;
  const fields: IFormField[] = useMemo(
    () => [
      { name: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Herbie Hancock', required: true },
      { name: 'email', label: 'Email', type: 'email', placeholder: 'e.g. your@email.com', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', placeholder: 'e.g. 1 (000) 000-0000' },
      { name: 'address', label: 'address', type: 'address', required: true },
      {
        name: 'agree',
        type: 'checkbox',
        label: 'Agree',
        required: true,
        msg: `By submitting this form you consent to receive SMS/text messages from ${merchantName}, at the number you provided. Messages may be sent by autodialer. Consent is not a condition of purchase. Message frequency varies (up to 2 msgs/mo). Message & data rates may apply.`,
        width: '100%',
      },
      { name: 'services', label: 'services needed', type: 'text', required: true },
    ],
    [merchantName]
  );

  // Modal builders
  const buildSuccessModal = () => ({
    title: 'Request sent',
    children: (
      <div style={{ padding: 16 }}>
        Thanks! We’ve received your request and will be in touch shortly.
      </div>
    ),
    confirm: {
      statements: [{ label: 'Close', onClick: () => closeModal() }],
    },
  });

  const handleSubmit = (form: any) => {
    // TODO: backend integration
    // console.log({ form });
    replaceModal(buildSuccessModal());
  };

  const buildContactFormModal = () => ({
    title: 'Contact us',
    children: (
      <ContactForm
        fields={fields}
        onSubmit={handleSubmit}
        submit={{ text: 'Send' }}
        title={false}
      />
    ),
    confirm: {
      statements: [{ label: 'Close', onClick: () => closeModal() }],
    },
  });

  const handleCart = (newQty?: number) => {
    if (!product || !primaryPrice) return; // safety
    addCartItem({ ...product, price: { ...primaryPrice, qty: Number(newQty) } });

    if (goToCart && newQty) {
      openModal({
        title: `${product.name}, added to cart`,
        confirm: {
          statements: [
            { label: 'go to cart', href: '/cart' },
            { label: 'back', onClick: () => closeModal() },
          ],
        },
      });
    }
  };

  const openZeroPriceFlow = () => {
    openModal({
      title: 'Contact us',
      children: <ContactUs />,
      confirm: {
        statements: [
          {
            label: 'submit request',
            variant: 'primary',
            // keep modal open and swap to contact form
            closeOnClick: false,
            replace: buildContactFormModal(),
          },
          { label: 'Close', onClick: () => closeModal() },
        ],
      },
    });
  };

  // Render (no early returns before hooks)
  return (
    <>
      <style jsx>{styles}</style>
      {!product ? (
        <>No Product</>
      ) : primaryPrice?.unit_amount === 0 ? (
        <UiButton
          onClick={openZeroPriceFlow}
          traits={{ beforeIcon: 'fa-handshake', ...traits }}
          disabled={!product?.active}
          size={size}
          variant={variant || 'primary'}
        >
          Get Quote
        </UiButton>
      ) : qty === 0 ? (
        <UiButton
          label={
            isDisabled && product?.name
              ? `${product.name}${primaryPrice?.nickname ? ` ${primaryPrice.nickname}` : ''} unavailable`
              : undefined
          }
          onClick={() => handleCart(1 + Number(qty))}
          traits={{ beforeIcon: 'fas-cart-shopping-fast', ...traits }}
          disabled={isDisabled || purchasedRecurring}
          size={size}
          variant={variant || 'primary'}
          busy={purchasedRecurring ? undefined : !Boolean(primaryPrice?.unit_amount) || undefined}
        >
          {purchasedRecurring ? 'purchased' : lastPurchased ?? label}
        </UiButton>
      ) : (
        <UiPill
          traits={traits}
          variant="center dark"
          amount={qty}
          min={0}
          increment={1}
          showTrashAtMinPlusStep
          setAmount={(newQty) => handleCart(newQty)}
        />
      )}
    </>
  );
};

export default ProductBuyNow;
