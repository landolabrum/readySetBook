import { getService } from '@webstack/common';
import { useCallback, useEffect, useState } from 'react';
import IMemberService from '../IMemberService';
import IPaymentIntent from '~/src/models/Shopping/IPaymentIntent';
import { useUser } from '~/src/core/authentication/hooks/useUser';

export interface IPurchase {
  intent: IPaymentIntent;
  created: number; // epoch seconds of the latest matching succeeded intent
  isRecurring: boolean;
}

// One in-flight/settled request per user id, shared by every mounted instance
// (product listings mount many ProductBuyNow at once → still a single fetch).
const intentCache = new Map<string, Promise<IPaymentIntent[]>>();

const fetchIntentsOnce = (userId: string): Promise<IPaymentIntent[]> => {
  let cached = intentCache.get(userId);
  if (!cached) {
    cached = getService<IMemberService>('IMemberService')
      .getPaymentIntents(userId)
      .then((body: any) => {
        const items: IPaymentIntent[] = Array.isArray(body?.data) ? body.data : [];
        // `customer` may be a string id or an expanded object from Stripe.
        return items.filter((pi) => {
          const cust: any = pi?.customer;
          return (typeof cust === 'string' ? cust : cust?.id) === userId;
        });
      })
      .catch(() => {
        intentCache.delete(userId); // let a later mount retry
        return [];
      });
    intentCache.set(userId, cached);
  }
  return cached;
};

// Price ids covered by an intent: mb_items metadata (one-time checkout),
// falling back to expanded invoice lines (subscription cycles).
const priceEntriesOf = (pi: IPaymentIntent): { price?: string; interval?: string | null }[] => {
  try {
    const mbItems = JSON.parse(pi.metadata?.mb_items || '');
    if (Array.isArray(mbItems)) return mbItems;
  } catch {}
  const invoice = pi.invoice;
  if (invoice && typeof invoice === 'object') {
    return (invoice.lines?.data || []).map((line) => ({
      price: line.price?.id,
      interval: line.price?.recurring?.interval ?? 'recurring',
    }));
  }
  return [];
};

/**
 * Single source of truth for the current user's payment intents.
 * intents: undefined = loading, [] = logged out / empty / error.
 */
const useUserPurchaseIntents = () => {
  const user = useUser();
  const [intents, setIntents] = useState<IPaymentIntent[] | undefined>(undefined);

  const load = useCallback((userId?: string) => {
    if (!userId) {
      setIntents([]); // service throws on a falsy customer id
      return;
    }
    let alive = true;
    setIntents(undefined);
    fetchIntentsOnce(userId).then((mine) => alive && setIntents(mine));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => load(user?.id), [user?.id, load]);

  const getPurchaseFor = useCallback(
    (priceId?: string): IPurchase | undefined => {
      if (!priceId || !intents?.length) return undefined;
      let latest: IPurchase | undefined;
      for (const pi of intents) {
        if (pi.status !== 'succeeded') continue;
        const entry = priceEntriesOf(pi).find((e) => e.price === priceId);
        if (!entry) continue;
        if (!latest || pi.created > latest.created) {
          latest = { intent: pi, created: pi.created, isRecurring: Boolean(entry.interval) };
        }
      }
      return latest;
    },
    [intents]
  );

  const refresh = useCallback(() => {
    if (user?.id) intentCache.delete(user.id);
    load(user?.id);
  }, [user?.id, load]);

  return { intents, loading: intents === undefined, getPurchaseFor, refresh };
};

export default useUserPurchaseIntents;
