/**
 * useCanopyFeed – data hook for the public CanopyFeed page.
 *
 * Fetches paginated live-event data from `/streaming/feed`,
 * with debounced search and abort-on-stale-request.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const serverUrl = String(process.env.NEXT_PUBLIC_PRODUCTION_SERVER?.trim() || '');

/* ───────── types ───────── */

export type FeedStream = {
    provider: string;
    userHandle?: string | null;
    enabled: boolean;
    status?: string | null;
    hlsUrl?: string | null;
};

export type FeedItem = {
    id: string;
    name: string;
    startsAt?: string | null;
    endsAt?: string | null;
    timezone?: string | null;
    isLive: boolean;
    designWidth?: number | null;
    designHeight?: number | null;
    streams: FeedStream[];
};

/* ───────── helpers ───────── */

/** Build the JPEG preview URL for a feed item's primary stream. */
export function buildPreviewUrl(item: FeedItem): string | null {
    const stream = item.streams[0];
    if (!stream) return null;
    return `${serverUrl}/streaming/user-streams/${encodeURIComponent(
        stream.provider,
    )}/preview?eventId=${encodeURIComponent(item.id)}`;
}

/* ───────── hook ───────── */

export function useCanopyFeed() {
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);

    const [search, setSearchRaw] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filter, setFilterRaw] = useState('live');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(24);
    const [total, setTotal] = useState(0);

    const abortRef = useRef<AbortController | null>(null);
    const mounted = useRef(true);

    // Debounce search (300 ms) and reset to page 1 on change
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch((prev) => {
                const next = search.trim();
                if (prev !== next) setPage(1);
                return next;
            });
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchFeed = useCallback(async () => {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (debouncedSearch) params.set('search', debouncedSearch);
            if (filter && filter !== 'all') params.set('filter', filter);
            params.set('page', String(page));
            params.set('limit', String(limit));

            const res = await fetch(`${serverUrl}/streaming/feed?${params}`, {
                signal: ac.signal,
            });
            if (!res.ok) throw new Error(`Feed request failed (${res.status})`);

            const data = await res.json();
            if (mounted.current && !ac.signal.aborted) {
                setItems(data.items ?? []);
                setTotal(data.total ?? 0);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
            if (mounted.current) setError(err);
        } finally {
            if (mounted.current && !ac.signal.aborted) setLoading(false);
        }
    }, [debouncedSearch, filter, page, limit]);

    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const setSearch = useCallback((v: string) => setSearchRaw(v), []);
    const setFilter = useCallback((v: string) => {
        setFilterRaw(v);
        setPage(1);
    }, []);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
        items,
        loading,
        error,
        search,
        setSearch,
        filter,
        setFilter,
        page,
        setPage,
        limit,
        setLimit,
        total,
        totalPages,
        refresh: fetchFeed,
    };
}
