export const DM_CACHE_PREFIX = "mb.dm.cache.";
export const DM_UNREAD_KEY = "mb.dm.unread";

export const clearDmStorage = () => {
    if (typeof window === "undefined") return;
    try {
        Object.keys(window.localStorage).forEach((key) => {
            if (key === DM_UNREAD_KEY || key.startsWith(DM_CACHE_PREFIX)) {
                window.localStorage.removeItem(key);
            }
        });
        window.dispatchEvent(new Event("storage"));
    } catch (err) {
        // best-effort; ignore
    }
};

export const persistUnread = (count: number) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(DM_UNREAD_KEY, String(count || 0));
        window.dispatchEvent(new Event("storage"));
    } catch (err) {
        // best-effort; ignore
    }
};