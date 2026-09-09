import { PaywallCopy } from "./types";

export const PAYWALL_PRODUCTS: Record<string, PaywallCopy> = {
  broadcastOsPro: {
    title: "BroadcastOS Pro",
    description:
      "Unlock pro-grade broadcasting, alerts, and prioritized support for mission-critical streams.",
    benefits: [
      "Pro scene presets and multi-source switching",
      "Priority ingest + uptime monitoring",
      "Direct support from the BroadcastOS team",
    ],
    ctaLabel: "Upgrade to Pro",
    secondaryCtaLabel: "Continue browsing",
  },
  default: {
    title: "Unlock premium access",
    description:
      "Purchase the required plan to continue. You can come back and retry right after checkout.",
    benefits: [
      "Full feature access",
      "Priority updates",
      "Instant unlock after purchase",
    ],
    ctaLabel: "Continue to checkout",
    secondaryCtaLabel: "Go back",
  },
};
