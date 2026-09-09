import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useRouter } from 'next/router';
import type { ParsedUrlQueryInput } from 'querystring';
import { useCanopyFeed } from '@Canopy/hooks/useCanopyFeed';
import type { FeedItem } from '@Canopy/hooks/useCanopyFeed';

interface CanopyFeedContextValue {
    feed: ReturnType<typeof useCanopyFeed>;
    refreshKey: number;
    selectedItem: FeedItem | null;
    selectItem: (item: FeedItem) => void;
    clearSelection: () => void;
    activeEventId: string | null;
    activeEvent: FeedItem | null;
    openEventPage: (item: FeedItem) => Promise<void>;
    closeEventPage: () => Promise<void>;
}

const CanopyFeedContext = createContext<CanopyFeedContextValue | undefined>(
    undefined,
);

export const CanopyFeedProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const feed = useCanopyFeed();
    const router = useRouter();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeEventId, setActiveEventId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(() =>
        Math.floor(Date.now() / 30000),
    );

    useEffect(() => {
        const id = setInterval(
            () => setRefreshKey(Math.floor(Date.now() / 30000)),
            30_000,
        );
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const queryEventId = router.query?.eventId;
        if (typeof queryEventId === 'string') {
            setActiveEventId(queryEventId);
        } else if (Array.isArray(queryEventId) && queryEventId[0]) {
            setActiveEventId(queryEventId[0]);
        } else if (!queryEventId) {
            setActiveEventId(null);
        }
    }, [router.query?.eventId]);

    const selectedItem = useMemo(() => {
        if (!selectedId) return null;
        return feed.items.find((item) => item.id === selectedId) ?? null;
    }, [feed.items, selectedId]);

    const activeEvent = useMemo(() => {
        if (!activeEventId) return null;
        return feed.items.find((item) => item.id === activeEventId) ?? null;
    }, [feed.items, activeEventId]);

    const selectItem = useCallback((item: FeedItem) => setSelectedId(item.id), []);
    const clearSelection = useCallback(() => setSelectedId(null), []);

    const openEventPage = useCallback(
        async (item: FeedItem) => {
            setActiveEventId(item.id);
            setSelectedId(null);

            const nextQuery = { ...router.query, eventId: item.id };
            await router.push({ pathname: '/feed', query: nextQuery }, undefined, {
                shallow: true,
            });
        },
        [router],
    );

    const closeEventPage = useCallback(async () => {
        setActiveEventId(null);
        const nextQuery = { ...router.query } as ParsedUrlQueryInput;
        delete nextQuery.eventId;

        await router.replace({ pathname: '/feed', query: nextQuery }, undefined, {
            shallow: true,
        });
    }, [router]);

    const value = useMemo(
        () => ({
            feed,
            refreshKey,
            selectedItem,
            selectItem,
            clearSelection,
            activeEventId,
            activeEvent,
            openEventPage,
            closeEventPage,
        }),
        [
            feed,
            refreshKey,
            selectedItem,
            selectItem,
            clearSelection,
            activeEventId,
            activeEvent,
            openEventPage,
            closeEventPage,
        ],
    );

    return (
        <CanopyFeedContext.Provider value={value}>
            {children}
        </CanopyFeedContext.Provider>
    );
};

export function useCanopyFeedContext() {
    const ctx = useContext(CanopyFeedContext);
    if (!ctx) {
        throw new Error('useCanopyFeedContext must be used within a CanopyFeedProvider');
    }
    return ctx;
}
