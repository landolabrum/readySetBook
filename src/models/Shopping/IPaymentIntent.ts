// Light typing for Stripe PaymentIntents returned by GET /payment-intent/s
// (expanded: customer, payment_method, latest_charge, invoice). Deep Stripe
// blobs stay loose on purpose — consumers only rely on the fields below.

export interface IPaymentIntentPriceLine {
  price?: { id?: string; recurring?: { interval?: string } | null };
}

export default interface IPaymentIntent {
  id: string;
  amount: number; // cents
  currency: string;
  status: string; // 'succeeded' | 'requires_payment_method' | ...
  created: number; // epoch seconds
  customer?: string | { id: string; email?: string };
  payment_method?: { card?: { brand?: string; last4?: string } } | any;
  latest_charge?: any;
  invoice?: string | { id?: string; lines?: { data?: IPaymentIntentPriceLine[] } };
  // mb_items: JSON string of [{ price, qty, interval }] stamped at checkout
  metadata?: { mb_items?: string; [key: string]: any };
}
