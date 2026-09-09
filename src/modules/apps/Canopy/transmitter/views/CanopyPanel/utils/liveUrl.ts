import environment from "~/src/core/environment";

/**
 * Build the public /live/:id link (optionally carrying merchant mid as a query).
 * This is scoped to Canopy's livestream overlay URLs.
 */
export const buildLiveUrl = (eventId?: string | number): string => {
    if (!eventId) return "";
    const origin =
        typeof window !== "undefined" && window.location?.origin
            ? window.location.origin
            : "";
    const base = origin || (environment as any)?.publicBaseUrl || "";
    const url = new URL(`${base.replace(/\/$/, "")}/live/${eventId}`);
    const mid = (environment as any)?.merchant?.mid;
    if (mid) url.searchParams.set("mid", mid);
    return url.toString();
};
