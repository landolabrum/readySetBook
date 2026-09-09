import { PaywallRequirement } from "@/modules/paywall/types";

export const paywallConfig: PaywallRequirement = {
  requiresPaywall: true,
  stripeProductId: process.env.NEXT_PUBLIC_STRIPE_BROADCAST_PRODUCT_ID,
  stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BROADCAST_PRICE_ID,
  paywallSlug: "broadcastOsPro",
  // stripeProductId:""
};

export default paywallConfig;
