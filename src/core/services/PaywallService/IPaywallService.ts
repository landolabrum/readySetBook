import { PaywallMatch, PaywallRequirement } from "@/modules/paywall/types";

export interface PaywallCheckRequest extends PaywallRequirement {
  customerId: string;
  limit?: number;
}

export interface PaywallCheckResponse {
  entitled: boolean;
  matches: PaywallMatch[];
  checked: {
    customerId: string;
    stripePriceId?: string;
    stripeProductId?: string;
  };
}

export interface PaywallCheckoutRequest extends PaywallRequirement {
  customerId: string;
  quantity?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaywallCheckoutResponse {
  sessionId?: string;
  url?: string;
  status?: string;
  customerId?: string;
  priceId?: string;
  paywallSlug?: string;
}

export interface PaywallSubscriptionMatch {
  subscriptionId?: string;
  status?: string;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  priceIds?: string[];
  productIds?: string[];
}

export interface PaywallSubscriptionStatusRequest extends PaywallRequirement {
  customerId: string;
  limit?: number;
}

export interface PaywallSubscriptionStatusResponse {
  entitled: boolean;
  matches: PaywallSubscriptionMatch[];
  checked: {
    customerId: string;
    stripePriceId?: string;
    stripeProductId?: string;
  };
}

export interface BillingSubscription {
  id?: string;
  status?: string;
  priceId?: string;
  priceNickname?: string;
  productId?: string;
  amount?: number;
  currency?: string;
  interval?: string;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  entitles?: boolean;
}

export interface BillingPurchase {
  id?: string;
  amount?: number;
  currency?: string;
  created?: number;
  priceId?: string;
  qty?: number;
  interval?: string;
  coveredUntil?: number;
  refunded?: boolean;
  entitles?: boolean;
}

export interface MyBillingResponse {
  entitled: boolean;
  source?: "subscription" | "purchase" | null;
  coverageUntil?: number | null;
  subscriptions: BillingSubscription[];
  purchases: BillingPurchase[];
}

export default interface IPaywallService {
  checkEntitlement(request: PaywallCheckRequest): Promise<PaywallCheckResponse>;
  startCheckoutSession(
    request: PaywallCheckoutRequest
  ): Promise<PaywallCheckoutResponse>;
  getSubscriptionStatus(
    request: PaywallSubscriptionStatusRequest
  ): Promise<PaywallSubscriptionStatusResponse>;
  // Logged-in customer's compact billing state (JWT-derived identity — no args).
  getMyBilling(): Promise<MyBillingResponse>;
}
