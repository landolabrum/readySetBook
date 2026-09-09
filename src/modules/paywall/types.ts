export type PaywallStatus =
  | "idle"
  | "checking"
  | "allowed"
  | "blocked"
  | "starting_checkout"
  | "error";

export interface PaywallRequirement {
  requiresPaywall?: boolean;
  stripePriceId?: string;
  stripeProductId?: string;
  paywallSlug?: string;
  productKey?: string;
  quantity?: number;
}

export interface PaywallMatch {
  sessionId?: string;
  status?: string;
  paymentStatus?: string;
  priceIds?: string[];
  productIds?: string[];
}

export interface PaywallCheckResult {
  entitled: boolean;
  matches: PaywallMatch[];
}

export interface PaywallState {
  status: PaywallStatus;
  allowed: boolean;
  matches?: PaywallMatch[];
  needsAuth?: boolean;
  error?: string;
}

export interface PaywallCopy {
  title: string;
  description: string;
  benefits?: string[];
  ctaLabel?: string;
  secondaryCtaLabel?: string;
}
