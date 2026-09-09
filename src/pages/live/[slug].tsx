// pages/live/[slug].tsx
import dynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const CanopyPage = dynamic(
  () => import('@Canopy/receiver/pages/CanopyPage/controller/CanopyPage').then((m) => m.default),
  { ssr: false }
);

const LiveSlugPage: React.FC = () => {
  const router = useRouter();

  // Start empty; derive once router is ready. Avoid conditional hooks/early return.
  const [pinned, setPinned] = useState<string | undefined>(undefined);

  // Derive event id from query (event | id | slug) or URL search param on the client
  useEffect(() => {
    if (!router || !router.isReady) return;
    const qe = router.query?.event as string | string[] | undefined;
    const qid = router.query?.id as string | string[] | undefined;
    const slug = router.query?.slug as string | string[] | undefined;
    const fromEvent = Array.isArray(qe) ? qe[0] : qe;
    const fromId = Array.isArray(qid) ? qid[0] : qid;
    const fromSlug = Array.isArray(slug) ? slug[0] : slug;

    let next = fromEvent ?? fromId ?? fromSlug;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const fromQuery = p.get('event') || p.get('eventId') || p.get('id') || undefined;
      next = fromQuery ?? next;
    }

    setPinned((prev) => prev ?? (next || undefined));
  }, [router]);

  // Normalize the URL to /live?event={pinned} once we know it
  useEffect(() => {
    console.log('pinned event id:', pinned);
    if (!router || !router.isReady || !pinned) return;
    if (typeof window === 'undefined') return;
    if (!window.location.search.includes('event=')) {
      const pathname = '/live';
      const query = { ...router.query, event: pinned } as Record<string, any>;
      delete (query as any).id;
      delete (query as any).slug;
      router.replace({ pathname, query }, undefined, { shallow: true }).catch(() => { });
    }
  }, [router, pinned]);
  return <CanopyPage fullscreen eventId={pinned} />;
};

export default LiveSlugPage;
