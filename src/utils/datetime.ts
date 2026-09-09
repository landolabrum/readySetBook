// Generic datetime helpers for HTML datetime-local inputs

/**
 * Convert an ISO string to a value suitable for a datetime-local input.
 * Returns an empty string on invalid or missing input.
 */
export function toLocalInputValue(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(+d)) return "";
    // Adjust for timezone offset so the local input shows the correct local time
    const localMs = d.getTime() - d.getTimezoneOffset() * 60000;
    return new Date(localMs).toISOString().slice(0, 16);
}

/**
 * Convert a datetime-local input value into a UTC ISO string.
 * Returns null on invalid or missing input.
 */
export function toISO(dtLocal?: string | null): string | null {
    if (!dtLocal) return null;
    const d = new Date(dtLocal);
    return Number.isNaN(+d) ? null : d.toISOString();
}
