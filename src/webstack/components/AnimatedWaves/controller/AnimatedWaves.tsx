// Relative Path: ./controller/AnimatedWaves.tsx
import React, { useMemo } from "react";
import styles from "./AnimatedWaves.scss";
import AnimatedWaveLayer, { type WaveLayer } from "../views/AnimatedWaveLayer/AnimatedWaveLayer";

export type AnimatedWavesProps = {
    animated?: boolean;

    /**
     * Each layer only needs colors + optional tuning.
     * Paths are AUTO-generated per-layer based on layer index + viewBox height.
     */
    waves: Omit<WaveLayer, "paths">[];

    /** Any CSS height: "100%", "500px", 520 */
    height?: string | number;

    /** degrees, any number. Example: 270 */
    gradientAngle?: number;

    /** SVG viewBox */
    viewBox?: string;

    /** preserveAspectRatio override */
    preserveAspectRatio?: string;

    className?: string;
    style?: React.CSSProperties;

    /**
     * Shape tuning (optional)
     * - baseline: where the first layer starts (0..1 of viewBox height)
     * - spread: how much vertical space the stack occupies (0..1)
     */
    baseline?: number;
    spread?: number;
};

const DEFAULT_VIEWBOX = "0 0 1440 590";

const AnimatedWaves: React.FC<AnimatedWavesProps> = ({
    animated = true,
    waves,
    height = "100%",
    gradientAngle = 270,
    viewBox = DEFAULT_VIEWBOX,
    preserveAspectRatio = "none",
    className = "",
    style,
    baseline = 0.15,
    spread = 0.65,
}) => {
    const wrapperStyle = useMemo<React.CSSProperties>(() => {
        const h = typeof height === "number" ? `${height}px` : height;
        return { height: h, ...style };
    }, [height, style]);

    const uid = useMemo(() => `aw_${Math.random().toString(16).slice(2)}`, []);

    const vb = useMemo(() => parseViewBox(viewBox), [viewBox]);

    // AUTO-generate paths for each wave layer using viewBox dims + stacking.
    const layers = useMemo(() => {
        const count = Math.max(0, waves?.length ?? 0);
        if (!count) return [];

        const yMin = vb.height * clamp(baseline, 0, 1);
        const yMax = vb.height * clamp(baseline + spread, 0, 1);
        const step = count > 1 ? (yMax - yMin) / (count - 1) : 0;

        return waves.map((w, idx) => {
            const levelY = yMin + step * idx;

            return {
                ...w,
                paths: generateMorphPaths({
                    width: vb.width,
                    height: vb.height,
                    y: levelY,
                    index: idx,
                    count,
                }),
            };
        });
    }, [waves, vb.width, vb.height, baseline, spread]);

    return (
        <>
            <style jsx>{styles}</style>

            <div className={`animated-waves ${className}`} style={wrapperStyle}>
                <svg
                    className="animated-waves__svg"
                    width="100%"
                    height="100%"
                    viewBox={viewBox}
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio={preserveAspectRatio}
                    aria-hidden="true"
                >
                    {layers.map((wave, idx) => (
                        <AnimatedWaveLayer
                            key={`${uid}_layer_${idx}`}
                            uid={uid}
                            index={idx}
                            wave={wave as WaveLayer}
                            animated={animated}
                            gradientAngle={gradientAngle}
                        />
                    ))}
                </svg>
            </div>
        </>
    );
};

export default AnimatedWaves;

/* -----------------------------
   Auto Path Generation
   - Produces compatible paths for SMIL morphing
   - Same command structure across keyframes
----------------------------- */

function generateMorphPaths(args: {
    width: number;
    height: number;
    y: number;
    index: number;
    count: number;
}): string[] {
    const { width: W, height: H, y, index, count } = args;

    // stack-aware amplitude: deeper layers can be smoother/larger
    const t = count <= 1 ? 0 : index / (count - 1);
    const ampBase = lerp(H * 0.018, H * 0.06, t); // ~10px..35px at 590h
    const amp = ampBase;

    // number of wave "sections" across width (kept constant so paths stay compatible)
    const segs = 6; // 6 cubic segments => stable morphing
    const dx = W / segs;

    // 4 keyframes (matches your earlier generator vibe)
    const phases = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

    return phases.map((phase, k) => {
        // Each keyframe nudges the profile (phase shift + slight amp drift)
        const ampK = amp * (0.92 + 0.08 * Math.sin(phase + t * Math.PI));
        const wobble = H * 0.01 * Math.sin(phase * 0.7 + t * 2.1); // subtle vertical drift
        const baseY = clamp(y + wobble, 0, H);

        // Build cubic bezier wave with consistent commands:
        // M 0,H  L 0,baseY  C ...  ...  ...  L W,H  L 0,H Z
        // IMPORTANT: same number of "C" commands each time.
        let d = `M 0,${H} L 0,${round(baseY)}`;

        let prevX = 0;
        let prevY = baseY;

        for (let i = 1; i <= segs; i++) {
            const x = dx * i;

            // Center point for this segment
            const midX = prevX + dx / 2;

            // Wave height at endpoints
            const y0 = prevY;
            const y1 = baseY + ampK * Math.sin((i * 2 * Math.PI) / segs + phase + t * 1.7);

            // Control points: horizontal handles, vertical oscillation for smooth curve
            const c1x = prevX + dx * 0.33;
            const c2x = prevX + dx * 0.66;

            // Give controls a bit of anticipation/overshoot
            const c1y = y0 + ampK * 0.35 * Math.sin(((i - 0.5) * 2 * Math.PI) / segs + phase + t);
            const c2y = y1 - ampK * 0.35 * Math.sin(((i - 0.5) * 2 * Math.PI) / segs + phase + t);

            d += ` C ${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(x)},${round(y1)}`;

            prevX = x;
            prevY = y1;
        }

        d += ` L ${W},${H} L 0,${H} Z`;
        return d;
    });
}

/* -----------------------------
   Utils
----------------------------- */

function parseViewBox(viewBox: string) {
    // "minX minY width height"
    const parts = (viewBox || "").trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
    }
    // fallback to default dims
    return { minX: 0, minY: 0, width: 1440, height: 590 };
}

function clamp(n: number, a: number, b: number) {
    return Math.min(b, Math.max(a, n));
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function round(n: number) {
    return Math.round(n * 1000) / 1000;
}
