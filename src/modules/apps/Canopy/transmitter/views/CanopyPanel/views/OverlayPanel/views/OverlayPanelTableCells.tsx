
const preferredQueryKeys = ['id', 'v', 'name', 'stream', 'channel', 'video', 'cam', 'key'];
const genericSegments = ['playlist', 'index', 'stream', 'live', 'video', 'watch', 'hls', 'dash', 'manifest', 'file', 'media', 'api', 'rtsp', 'm3u8', 'play', 'view'];

const stripExtension = (segment: string) => segment.replace(/\.[^/.]+$/, '');
const isGeneric = (segment: string) => genericSegments.includes(segment.toLowerCase());
const ENABLED_COLOR = 'var(--green-30)';
const DISABLED_COLOR = 'var(--gray-100)';
export const extractOverlayName = (raw?: string): string | undefined => {
    if (!raw || typeof raw !== 'string') return undefined;
    // console.log("Extracting name from overlay URL:", raw);
    try {
        const url = new URL(raw);

        for (const key of preferredQueryKeys) {
            const val = url.searchParams.get(key);
            if (val) return val;
        }

        const segments = url.pathname.split('/').filter(Boolean);
        if (!segments.length) return url.hostname;

        const last = stripExtension(segments[segments.length - 1]);
        if (last && !isGeneric(last)) return last;

        const first = stripExtension(segments[0]);
        if (first && !isGeneric(first)) return first;

        const meaningful = segments.map(stripExtension).filter((s) => s && !isGeneric(s));
        if (meaningful.length) return meaningful.sort((a, b) => b.length - a.length)[0];

        return last || first || url.hostname;
    } catch (_err) {
        const parts = raw.split(/[/?]/).filter(Boolean);
        if (parts.length) return stripExtension(parts[parts.length - 1]);
        return raw;
    }
};

export const OverlayLabelCell = (o: any) => {
    let labelStyle: any = { display: 'flex', flexDirection: "column",  justifyContent: "flex-start", maxWidth: "100%", textOverflow: "ellipses",  overflow: "hidden", gap: '2px', fontWeight:"900",
        color: DISABLED_COLOR, "--ui-icon-color": DISABLED_COLOR};
    if (o?.enabled) {
        labelStyle.color = ENABLED_COLOR; labelStyle["--ui-icon-color"] = ENABLED_COLOR;
    }

    if (o?.type == 'media') {
        const primaryTitleOrUrl = o?.title || o?.urls?.[0] || o?.data?.urls?.[0];
        const displayName = extractOverlayName(primaryTitleOrUrl) || 'Media Overlay';

        return <div style={{ ...labelStyle }} className="">
            <div>{displayName}</div>
            <small>   {o.type} | {o.variant || "-"}</small>
        </div>
    }

    return <div style={{ ...labelStyle }}>{o?.type || 'Overlay'} <small>ID: {o?.id || 'N/A'})</small></div>
};