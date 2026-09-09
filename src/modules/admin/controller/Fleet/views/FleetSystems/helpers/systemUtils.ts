import type { RangeKey } from './types';

export const rangeToMs = (r: RangeKey) => (r === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000);

export const clampPct = (n?: number | null) =>
    Math.max(0, Math.min(100, Number(n ?? 0)));

// A device/metric row is considered stale (offline) once its last sample is
// older than this. Shared by the devices table + tree.
export const STALE_THRESHOLD_MS = Number(process.env.NEXT_PUBLIC_STALE_THRESHOLD_MS) || 5 * 60 * 1000;// 5 minutes

// Format a percentage for display with an em-dash fallback for missing/non-finite values.
export const formatPct = (n?: number | null): string =>
    n == null || !Number.isFinite(Number(n)) ? '—' : `${Number(n).toFixed(1)}%`;

// Relative "time ago" label from an ISO timestamp. Returns '—' for missing/invalid input.
export const timeAgo = (iso?: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso).getTime();
    if (!d) return '—';
    const diff = Date.now() - d;
    if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
    return `${Math.round(diff / 86_400_000)}d ago`;
};

export const humanBytes = (n: number) => {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(n) / Math.log(1024));
    return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
};

export const pickTemp = (map: Record<string, number>, candidates: string[]) => {
    for (const k of candidates) {
        if (typeof map[k] === 'number') return { name: k, value: map[k] };
    }
    const entries = Object.entries(map).filter(([, v]) => typeof v === 'number');
    if (entries.length) {
        const [name, value] = entries.reduce((acc, cur) => (cur[1] > acc[1] ? cur : acc));
        return { name, value } as { name: string; value: number };
    }
    return undefined;
};
