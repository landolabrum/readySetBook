import environment from "@/core/environment";
import ApiService from "../ApiService";
import IPaywallService, {
  MyBillingResponse,
  PaywallCheckRequest,
  PaywallCheckResponse,
  PaywallCheckoutRequest,
  PaywallCheckoutResponse,
  PaywallSubscriptionStatusRequest,
  PaywallSubscriptionStatusResponse,
} from "./IPaywallService";
import { PaywallMatch } from "@/modules/paywall/types";

const PAYWALL_BASE = "usage/checkout";

const cleanPayload = (payload: Record<string, any>) => {
  const cleaned = { ...payload };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) delete cleaned[key];
  });
  return cleaned;
};

export default class PaywallService
  extends ApiService
  implements IPaywallService {
  constructor() {
    super(environment.serviceEndpoints.membership);
  }

  private normalizeMatch = (match: any): PaywallMatch => ({
    sessionId: match?.session_id ?? match?.sessionId,
    status: match?.status,
    paymentStatus: match?.payment_status ?? match?.paymentStatus,
    priceIds: match?.price_ids ?? match?.priceIds ?? [],
    productIds: match?.product_ids ?? match?.productIds ?? [],
  });

  async checkEntitlement(
    request: PaywallCheckRequest
  ): Promise<PaywallCheckResponse> {
    const payload = cleanPayload({
      customer_id: request.customerId,
      stripe_price_id: request.stripePriceId,
      stripe_product_id: request.stripeProductId,
      limit: request.limit ?? 25,
    });

    const response = await this.post<typeof payload, any>(
      `${PAYWALL_BASE}/entitlements/check`,
      payload
    );

    const matches = Array.isArray(response?.matches)
      ? response.matches.map((match: any) => this.normalizeMatch(match))
      : [];

    return {
      entitled: Boolean(response?.entitled),
      matches,
      checked: {
        customerId: request.customerId,
        stripePriceId: request.stripePriceId,
        stripeProductId: request.stripeProductId,
      },
    };
  }

  async startCheckoutSession(
    request: PaywallCheckoutRequest
  ): Promise<PaywallCheckoutResponse> {
    const payload = cleanPayload({
      customer_id: request.customerId,
      stripe_price_id: request.stripePriceId,
      stripe_product_id: request.stripeProductId,
      quantity: request.quantity ?? 1,
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      paywall_slug: request.paywallSlug || request.productKey,
    });

    const response = await this.post<typeof payload, any>(
      `${PAYWALL_BASE}/paywall/session`,
      payload
    );

    return {
      sessionId: response?.session_id ?? response?.id,
      url: response?.url,
      status: response?.status,
      customerId: response?.customer_id ?? request.customerId,
      priceId: response?.price_id ?? request.stripePriceId,
      paywallSlug:
        response?.paywall_slug ?? request.paywallSlug ?? request.productKey,
    };
  }

  async getMyBilling(): Promise<MyBillingResponse> {
    // Identity rides the JWT (ApiService default headers) — no args.
    const res = await this.get<any>(`${PAYWALL_BASE}/my/billing`);
    const subs = Array.isArray(res?.subscriptions) ? res.subscriptions : [];
    const buys = Array.isArray(res?.purchases) ? res.purchases : [];
    return {
      entitled: Boolean(res?.entitled),
      source: res?.source ?? null,
      coverageUntil: res?.coverage_until ?? res?.coverageUntil ?? null,
      subscriptions: subs.map((s: any) => ({
        id: s?.id,
        status: s?.status,
        priceId: s?.price_id ?? s?.priceId,
        priceNickname: s?.price_nickname ?? s?.priceNickname,
        productId: s?.product_id ?? s?.productId,
        amount: s?.amount,
        currency: s?.currency,
        interval: s?.interval,
        currentPeriodEnd: s?.current_period_end ?? s?.currentPeriodEnd,
        cancelAtPeriodEnd: s?.cancel_at_period_end ?? s?.cancelAtPeriodEnd,
        entitles: Boolean(s?.entitles),
      })),
      purchases: buys.map((p: any) => ({
        id: p?.id,
        amount: p?.amount,
        currency: p?.currency,
        created: p?.created,
        priceId: p?.price_id ?? p?.priceId,
        qty: p?.qty,
        interval: p?.interval,
        coveredUntil: p?.covered_until ?? p?.coveredUntil,
        refunded: Boolean(p?.refunded),
        entitles: Boolean(p?.entitles),
      })),
    };
  }

  async getSubscriptionStatus(
    request: PaywallSubscriptionStatusRequest
  ): Promise<PaywallSubscriptionStatusResponse> {
    const payload = cleanPayload({
      customer_id: request.customerId,
      stripe_price_id: request.stripePriceId,
      stripe_product_id: request.stripeProductId,
      limit: request.limit ?? 25,
    });

    const response = await this.post<typeof payload, any>(
      `${PAYWALL_BASE}/paywall/subscription_status`,
      payload
    );

    const matches = Array.isArray(response?.matches)
      ? response.matches.map((match: any) => ({
        subscriptionId: match?.subscription_id ?? match?.subscriptionId,
        status: match?.status,
        currentPeriodEnd:
          match?.current_period_end ?? match?.currentPeriodEnd,
        cancelAtPeriodEnd:
          match?.cancel_at_period_end ?? match?.cancelAtPeriodEnd,
        priceIds: match?.price_ids ?? match?.priceIds ?? [],
        productIds: match?.product_ids ?? match?.productIds ?? [],
      }))
      : [];

    return {
      entitled: Boolean(response?.entitled),
      matches,
      checked: {
        customerId: request.customerId,
        stripePriceId: request.stripePriceId,
        stripeProductId: request.stripeProductId,
      },
    };
  }
}
