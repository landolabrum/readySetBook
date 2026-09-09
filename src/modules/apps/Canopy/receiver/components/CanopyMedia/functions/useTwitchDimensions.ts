import { useEffect, useMemo, useState } from "react";

interface UseTwitchDimensionsOpts {
    designWidth?: number | string;
    designHeight?: number | string;
    eventId?: string | number;
}

export function useTwitchDimensions({ designWidth, designHeight, eventId }: UseTwitchDimensionsOpts) {
    const baseWidth = useMemo(
        () => (Number.isFinite(designWidth as number) ? Number(designWidth) : 1920),
        [designWidth]
    );
    const baseHeight = useMemo(
        () => (Number.isFinite(designHeight as number) ? Number(designHeight) : 1080),
        [designHeight]
    );

    const hasExplicitDesignDims = useMemo(
        () => designWidth != null || designHeight != null,
        [designWidth, designHeight]
    );

    const [dim, setDim] = useState<{ w: number; h: number }>({ w: baseWidth, h: baseHeight });

    // Sync when the caller-provided dims change
    useEffect(() => {
        setDim({ w: baseWidth, h: baseHeight });
    }, [baseWidth, baseHeight]);

    // Pull twitch config so live render matches encoder settings
    useEffect(() => {
        const controller = new AbortController();

        if (hasExplicitDesignDims) {
            return () => controller.abort();
        }

        const coerceNumber = (val: unknown): number | undefined => {
            if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
            if (typeof val === "string") {
                const n = Number(val.trim());
                if (Number.isFinite(n) && n > 0) return n;
            }
            return undefined;
        };

        const parseConfigDims = (cfg: any): { w?: number; h?: number } => {
            if (!cfg || typeof cfg !== "object") return {};

            const directW = coerceNumber((cfg as any).width ?? (cfg as any).video_width ?? (cfg as any).w);
            const directH = coerceNumber((cfg as any).height ?? (cfg as any).video_height ?? (cfg as any).h);

            if (directW && directH) return { w: directW, h: directH };

            const resStr = typeof (cfg as any).resolution === "string" ? (cfg as any).resolution : undefined;
            if (resStr && /\d+x\d+/i.test(resStr)) {
                const [rw, rh] = resStr.split(/x/i).map((s: string) => coerceNumber(s));
                if (rw && rh) return { w: rw, h: rh };
            }

            return { w: directW, h: directH };
        };

        const load = async () => {
            try {
                const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
                const query = eventId != null ? `?eventId=${encodeURIComponent(String(eventId))}` : "";
                const res = await fetch(`${apiBase}/streaming/twitch/config${query}`, { signal: controller.signal });
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json?.config) return;

                const { w, h } = parseConfigDims(json.config);
                const nextW = w && w > 0 ? w : dim.w;
                const nextH = h && h > 0 ? h : dim.h;

                if (nextW !== dim.w || nextH !== dim.h) {
                    setDim({ w: nextW, h: nextH });
                }
            } catch {
                // best-effort only
            }
        };
        void load();
        return () => controller.abort();
    }, [dim.w, dim.h, eventId, hasExplicitDesignDims]);

    return dim;
}
