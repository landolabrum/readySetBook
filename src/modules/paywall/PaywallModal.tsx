import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getService } from "@webstack/common";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import useCart from "~/src/modules/ecommerce/cart/hooks/useCart";
import IPaywallService from "@/core/services/PaywallService/IPaywallService";
import { PAYWALL_PRODUCTS } from "./copy";
import { PaywallRequirement } from "./types";
import styles from "./PaywallModal.scss";

interface Props {
  requirement: PaywallRequirement;
  customerId?: string;
  missingConfig?: boolean;
}

const PaywallModal: React.FC<Props> = ({ requirement, customerId, missingConfig }) => {
  const paywallService = useMemo(
    () => getService<IPaywallService>("IPaywallService"),
    []
  );
  const { closeModal } = useModal();
  const router = useRouter();
  const { addCartItem } = useCart();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | undefined>();

  const productKey =
    requirement.paywallSlug || requirement.productKey || "default";
  const copy = PAYWALL_PRODUCTS[productKey] || PAYWALL_PRODUCTS.default;

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!customerId) return;
      if (!requirement.stripePriceId && !requirement.stripeProductId) return;

      try {
        const response = await paywallService.getSubscriptionStatus({
          customerId,
          stripePriceId: requirement.stripePriceId,
          stripeProductId: requirement.stripeProductId,
          requiresPaywall: requirement.requiresPaywall,
        });

        if (!response.matches?.length) return;

        const first = response.matches[0];
        const ts = first.currentPeriodEnd;
        if (!ts) {
          setSubscriptionMessage("Subscription is active.");
          return;
        }

        const nowSeconds = Math.floor(Date.now() / 1000);
        const diffSeconds = ts - nowSeconds;
        const diffDays = Math.floor(diffSeconds / 86400);

        if (diffDays < 0) {
          setSubscriptionMessage("Your subscription for this app has expired.");
        } else if (diffDays <= 5) {
          setSubscriptionMessage(
            diffDays === 0
              ? "Your subscription expires today."
              : `Your subscription expires in ${diffDays} day${diffDays === 1 ? "" : "s"
              }.`
          );
        } else {
          const expiryDate = new Date(ts * 1000).toLocaleDateString();
          setSubscriptionMessage(`Subscription active until ${expiryDate}.`);
        }
      } catch {
        // Silent failure; paywall still works without status messaging.
      }
    };

    fetchSubscriptionStatus();
  }, [customerId, paywallService, requirement.requiresPaywall, requirement.stripePriceId, requirement.stripeProductId]);

  const handleCheckout = async () => {
    if (missingConfig) {
      setError("Paywall is missing a Stripe product or price ID.");
      return;
    }
    setLoading(true);
    setError(undefined);

    try {
      // NOTE: We intentionally reuse the existing cart + checkout flow
      // instead of starting a separate Stripe-hosted checkout session.
      // The specific product should already be available in the storefront;
      // here we simply guide the user into the cart/checkout experience.

      await router.push("/cart");
      closeModal();
    } catch (e: any) {
      setError(e?.message || "Unable to start checkout right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => closeModal();

  return (
    <>
      <style jsx>{styles}</style>
      <div className="paywall-modal">
        <div className="paywall-modal__pill">Paywall</div>
        <h2 className="paywall-modal__title">{copy.title}</h2>
        <p className="paywall-modal__description">{copy.description}</p>

        {subscriptionMessage && (
          <div className="paywall-modal__subscription-status">
            {subscriptionMessage}
          </div>
        )}

        {copy.benefits && (
          <ul className="paywall-modal__list">
            {copy.benefits.map((benefit, index) => (
              <li key={index}>
                <UiIcon icon="fa-check" size="sm" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        )}

        {error && <div className="paywall-modal__error">{error}</div>}

        <div className="paywall-modal__actions">
          <UiButton
            onClick={handleCheckout}
            disabled={loading || missingConfig}
            variant="primary"
          >
            {loading ? "Starting checkout..." : copy.ctaLabel || "Continue"}
          </UiButton>
          <UiButton variant="ghost" onClick={handleClose}>
            {copy.secondaryCtaLabel || "Go back"}
          </UiButton>
        </div>

        <div className="paywall-modal__hint">
          {missingConfig && "Stripe price_id or product_id is required."}
          {!missingConfig &&
            "You’ll complete checkout on the cart page using your account and saved payment methods."}
        </div>
      </div>
    </>
  );
};

export default PaywallModal;
