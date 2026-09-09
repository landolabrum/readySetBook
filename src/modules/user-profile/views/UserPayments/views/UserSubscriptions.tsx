// Subscription & Access summary for the logged-in customer, fed by
// GET /usage/checkout/my/billing (identity from the login JWT — no props).
// Finally puts the previously-orphaned UserSubscriptions.scss to work.
import React, { useEffect, useState } from 'react';
import styles from '../UserSubscriptions.scss';
import { getService } from '@webstack/common';
import IPaywallService, { MyBillingResponse } from '~/src/core/services/PaywallService/IPaywallService';

const fmtDate = (epoch?: number | null) =>
    epoch ? new Date(epoch * 1000).toLocaleDateString() : '—';

const fmtAmount = (amount?: number, currency?: string, interval?: string) =>
    amount == null
        ? '—'
        : `$${(amount / 100).toFixed(2)} ${currency?.toUpperCase?.() || 'USD'}${interval ? `/${interval}` : ''}`;

const statusClass = (status?: string, entitles?: boolean) => {
    if (entitles) return 'succeeded';
    if (status === 'trialing') return 'pending';
    if (status === 'past_due' || status === 'unpaid') return 'requires_action';
    return 'canceled';
};

const UserSubscriptions: React.FC = () => {
    const [billing, setBilling] = useState<MyBillingResponse | undefined | null>(undefined);

    useEffect(() => {
        let active = true;
        getService<IPaywallService>('IPaywallService')
            .getMyBilling()
            .then((res) => active && setBilling(res))
            .catch(() => active && setBilling(null));
        return () => { active = false; };
    }, []);

    return (
        <>
            <style jsx>{styles}</style>
            <div className='subscriptions'>
                <div className='subscriptions__list'>
                    <div className='subscriptions__list-header'>
                        <div className='subscriptions__list-title'>
                            <h4>Subscription &amp; Access</h4>
                        </div>
                        {billing && (
                            <span className={`subscriptions__status subscriptions__status--${billing.entitled ? 'succeeded' : 'canceled'}`}>
                                {billing.entitled
                                    ? `Active${billing.coverageUntil ? ` · through ${fmtDate(billing.coverageUntil)}` : ''}`
                                    : 'No active access'}
                            </span>
                        )}
                    </div>

                    {billing === undefined && <div className='subscriptions__state'>Checking your access…</div>}
                    {billing === null && <div className='subscriptions__state'>Couldn&apos;t load subscription status.</div>}

                    {billing && billing.subscriptions.length === 0 && billing.purchases.length === 0 && (
                        <div className='subscriptions__state'>No subscriptions or access purchases yet.</div>
                    )}

                    {billing && billing.subscriptions.map((s) => (
                        <div className='subscriptions__table-row' key={s.id}>
                            <div className='subscriptions__table-method'>
                                {s.priceNickname || 'Subscription'} · {fmtAmount(s.amount, s.currency, s.interval)}
                            </div>
                            <span className={`subscriptions__status subscriptions__status--${statusClass(s.status, s.entitles)}`}>
                                {s.status}
                            </span>
                            <div className='subscriptions__detail-value'>
                                {s.cancelAtPeriodEnd ? 'ends' : 'renews'} {fmtDate(s.currentPeriodEnd)}
                            </div>
                        </div>
                    ))}

                    {billing && billing.purchases.map((p) => (
                        <div className='subscriptions__table-row' key={`${p.id}-${p.priceId}`}>
                            <div className='subscriptions__table-method'>
                                Prepaid access · {fmtAmount(p.amount, p.currency)} ({p.qty}× {p.interval})
                            </div>
                            <span className={`subscriptions__status subscriptions__status--${p.refunded ? 'canceled' : (p.entitles ? 'succeeded' : 'canceled')}`}>
                                {p.refunded ? 'refunded' : (p.entitles ? 'active' : 'expired')}
                            </span>
                            <div className='subscriptions__detail-value'>
                                covered through {fmtDate(p.coveredUntil)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default UserSubscriptions;
