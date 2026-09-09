// Relative Path: ./views/AnimatedWaveLayer/AnimatedWaveLayer.tsx
import React, { useMemo } from "react";
import styles from "./AnimatedWaveLayer.scss";

type GradientStop = {
    color: string;
    offset?: number; // 0..100
    opacity?: number; // 0..1
};

export type WaveLayer = {
    paths: string[];

    stops?: GradientStop[];
    colors?: string[];

    opacity?: number; // 0..1
    durationSec?: number; // seconds

    calcMode?: "linear" | "spline";
    keySplines?: string; // used only for spline

    blur?: number; // 0..N
};

export type AnimatedWaveLayerProps = {
    uid: string;
    index: number;
    wave: WaveLayer;
    animated: boolean;
    gradientAngle: number;
};

const AnimatedWaveLayer: React.FC<AnimatedWaveLayerProps> = ({
    uid,
    index,
    wave,
    animated,
    gradientAngle,
}) => {
    const w = useMemo(() => normalizeWave(wave), [wave]);

    const gradId = `${uid}_grad_${index}`;
    const filterId = w.blur > 0 ? `${uid}_blur_${index}` : "";

    const anim = useMemo(() => buildAnimSpec(w), [w]);

    return (
        <>
            <style jsx>{styles}</style>

            <defs>
                <linearGradient
                    id={gradId}
                    x1="0%"
                    y1="50%"
                    x2="100%"
                    y2="50%"
                    gradientUnits="objectBoundingBox"
                    gradientTransform={`rotate(${gradientAngle} 0.5 0.5)`}
                >
                    {anim.stops.map((s, i) => (
                        <stop key={i} offset={`${s.offset}%`} stopColor={s.color} stopOpacity={s.opacity} />
                    ))}
                </linearGradient>

                {w.blur > 0 && (
                    <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation={w.blur} />
                    </filter>
                )}
            </defs>

            <path
                className={`animated-wave-layer__path animated-wave-layer__path--${index}`}
                d={anim.paths[0] ?? ""}
                fill={`url(#${gradId})`}
                fillOpacity={anim.opacity}
                stroke="none"
                filter={filterId ? `url(#${filterId})` : undefined}
            >
                {animated && anim.paths.length > 1 && (
                    <animate
                        attributeName="d"
                        dur={`${anim.durationSec}s`}
                        repeatCount="indefinite"
                        calcMode={anim.calcMode}
                        values={anim.values}
                        keyTimes={anim.keyTimes}
                        keySplines={anim.calcMode === "spline" ? anim.keySplines : undefined}
                    />
                )}
            </path>
        </>
    );
};

export default AnimatedWaveLayer;

/* -----------------------------
   Helpers
----------------------------- */

function normalizeWave(w: WaveLayer): Required<WaveLayer> {
    return {
        paths: Array.isArray(w.paths) ? w.paths.filter(Boolean) : [],
        stops: Array.isArray(w.stops) ? w.stops : [],
        colors: Array.isArray(w.colors) ? w.colors : [],
        opacity: typeof w.opacity === "number" ? clamp01(w.opacity) : 1,
        durationSec: typeof w.durationSec === "number" ? Math.max(0.1, w.durationSec) : 4,
        calcMode: w.calcMode === "spline" ? "spline" : "linear",
        keySplines:
            typeof w.keySplines === "string" && w.keySplines.trim()
                ? w.keySplines
                : "0.42 0 0.58 1",
        blur: typeof w.blur === "number" ? Math.max(0, w.blur) : 0,
    };
}

function buildAnimSpec(w: Required<WaveLayer>) {
    const paths = w.paths.length ? w.paths : [""];

    const stops = normalizeStops(w.stops, w.colors);

    // Loop back to first path for smooth wrap
    const looped = paths.length > 1 ? [...paths, paths[0]] : paths;
    const values = looped.join(";");

    const segmentCount = Math.max(1, looped.length - 1);
    const keyTimes = looped
        .map((_, idx) => (idx / segmentCount).toFixed(6))
        .join(";");

    const keySplines = w.calcMode === "spline" ? expandKeySplines(w.keySplines, segmentCount) : "";

    return {
        paths,
        stops,
        opacity: w.opacity,
        durationSec: w.durationSec,
        calcMode: w.calcMode,
        keyTimes,
        keySplines,
        values,
    };
}

function normalizeStops(stops: GradientStop[], colors: string[]): Required<GradientStop>[] {
    const base: GradientStop[] =
        stops.length >= 2
            ? stops
            : colors.length >= 2
                ? colors.map((c) => ({ color: c }))
                : [{ color: "#F78DA7" }, { color: "#8ED1FC" }];

    const clean = base
        .filter((s) => !!s.color)
        .map((s) => ({
            color: s.color,
            offset: typeof s.offset === "number" ? clamp(s.offset, 0, 100) : undefined,
            opacity: typeof s.opacity === "number" ? clamp01(s.opacity) : 1,
        }));

    const hasOffsets = clean.every((s) => typeof s.offset === "number");
    if (hasOffsets) return clean as Required<GradientStop>[];

    const n = clean.length;
    const step = n > 1 ? 100 / (n - 1) : 100;

    return clean.map((s, i) => ({
        color: s.color,
        opacity: s.opacity ?? 1,
        offset: typeof s.offset === "number" ? s.offset : i * step,
    }));
}

function expandKeySplines(keySplines: string, segments: number) {
    const ks = keySplines.trim();
    if (ks.includes(";")) return ks;
    return Array.from({ length: segments }, () => ks).join(";");
}

function clamp01(n: number) {
    return clamp(n, 0, 1);
}

function clamp(n: number, a: number, b: number) {
    return Math.min(b, Math.max(a, n));
}
