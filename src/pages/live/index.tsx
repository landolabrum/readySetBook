// pages/live/index.tsx
import dynamic from 'next/dynamic';
import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const CanopyPage = dynamic(() => import('@Canopy/receiver/pages/CanopyPage/controller/CanopyPage').then(m => m.default), {
  ssr: false,
});

const LiveIndexPage: React.FC = () => {
  const router = useRouter();
  // Capture initial event from URL once, independent of router.query mutations
  const initialFromUrl = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const p = new URLSearchParams(window.location.search);
    return p.get('event') || p.get('eventId') || p.get('id') || undefined;
  }, []);

  const [pinned, setPinned] = useState<string | undefined>(initialFromUrl);

  useEffect(() => {
    if (!router.isReady) return;
    const qe = router.query?.event as string | string[] | undefined;
    const qeid = router.query?.eventId as string | string[] | undefined;
    const qid = router.query?.id as string | string[] | undefined;
    const eventId = Array.isArray(qe) ? qe[0] : qe ?? (Array.isArray(qeid) ? qeid[0] : qeid) ?? (Array.isArray(qid) ? qid[0] : qid);
    if (eventId && !pinned) setPinned(eventId);
  }, [router.isReady, router.query, pinned]);

  // Keep URL canonical with ?event= when we have a pinned id
  useEffect(() => {
    if (!router.isReady || !pinned) return;
    if (typeof window === 'undefined') return;
    const search = window.location.search;
    if (!search.includes('event=')) {
      const pathname = '/live';
      const query = { ...router.query, event: pinned } as Record<string, any>;
      delete query.id;
      router.replace({ pathname, query }, undefined, { shallow: true }).catch(() => { });
    }
  }, [router.isReady, router.query, pinned]);

  return <CanopyPage fullscreen eventId={pinned} />;
};

export default LiveIndexPage;
