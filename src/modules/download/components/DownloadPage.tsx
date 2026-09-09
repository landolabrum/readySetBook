// Relative Path: ./DownloadPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { getService } from '@webstack/common';
import styles from './DownloadPage.scss';
import useDownloads from '../hooks/useDownloads';
import DownloadList from '../views/DownloadList/DownloadList';
import DownloadDetails from '../views/DownloadDetails/DownloadDetails';
import useProfile from '~/src/core/authentication/hooks/useProfile';
import IPaywallService from '~/src/core/services/PaywallService/IPaywallService';
import IDownloadService from '~/src/core/services/DownloadService/IDownloadService';
import { DeviceClass, IDownloadTarget } from '../models/IDownloadTarget';

// The Stripe product that grants download access. Configured per merchant;
// when unset the subscription check falls back to "any active/trialing sub".
const DOWNLOAD_PRODUCT_ID = process.env.NEXT_PUBLIC_DOWNLOAD_PRODUCT_ID || undefined;

const DownloadPage: React.FC = () => {
  const router = useRouter();
  const { targets, loading, error } = useDownloads();

  const profile: any = useProfile();
  const customerId: string | undefined = profile?.id;

  const paywall = useMemo(() => getService<IPaywallService>('IPaywallService'), []);
  const downloads = useMemo(() => getService<IDownloadService>('IDownloadService'), []);

  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [token, setToken] = useState<string | undefined>();

  const selectedId = (router.query.id as string) || undefined;
  const selected = useMemo<IDownloadTarget | undefined>(
    () => targets?.find((t) => t.deviceClass === selectedId),
    [targets, selectedId]
  );

  // ONE call gates AND mints: POST /download/entitlement derives the
  // customer from the login JWT; 200 => token, 403 => not entitled (show
  // the Subscribe CTA). Browsing the list costs zero entitlement calls.
  useEffect(() => {
    if (!customerId || !selected) {
      setToken(undefined);
      setEntitled(customerId ? null : false);
      return;
    }
    let active = true;
    setChecking(true);
    downloads
      .mintEntitlement({ deviceClass: selected.deviceClass })
      .then((r) => {
        if (!active) return;
        setEntitled(Boolean(r.entitled ?? r.token));
        setToken(r.token);
      })
      .catch(() => {
        if (!active) return;
        setEntitled(false);
        setToken(undefined);
      })
      .finally(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [customerId, selected, downloads]);

  const select = useCallback(
    (deviceClass: DeviceClass) => {
      router.push(
        { pathname: router.pathname, query: { ...router.query, id: deviceClass } },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  const clearSelection = useCallback(() => {
    const { id, ...rest } = router.query;
    router.push({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
  }, [router]);

  const startCheckout = useCallback(async () => {
    if (!customerId) return;
    const res = await paywall.startCheckoutSession({
      customerId,
      stripeProductId: DOWNLOAD_PRODUCT_ID,
      successUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      requiresPaywall: true,
    });
    if (res?.url && typeof window !== 'undefined') window.location.href = res.url;
  }, [customerId, paywall]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className='download-page'>
        <div className='download-page__header'>
          <h1 className='download-page__title'>Download the MindBurn Network</h1>
          <p className='download-page__subtitle'>
            Pick your device class and run one command — no installer, no Apple certificate.
          </p>
        </div>
        <div className='download-page__body'>
          {selected ? (
            <DownloadDetails
              target={selected}
              entitled={Boolean(entitled)}
              checking={checking}
              needsAuth={!customerId}
              token={token}
              onBack={clearSelection}
              onSubscribe={startCheckout}
            />
          ) : (
            <DownloadList
              targets={targets}
              loading={loading}
              error={error}
              onSelect={select}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default DownloadPage;
