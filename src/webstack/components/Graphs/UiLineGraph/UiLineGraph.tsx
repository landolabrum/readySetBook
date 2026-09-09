// Relative Path: ./UiLineGraph.tsx
import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import styles from './UiLineGraph.scss';

type Point = { x: number; y: number };
type Series = { points: Point[]; color?: string; label?: string };

type UiLineGraphProps = {
    data: Record<string, Series | Point[]>;
    variant?: 'grid' | 'plain';
    traits?: {
        background?: string;
        strokeWidth?: number;
        padding?: number;
        showDots?: boolean;
    };
};

const fallbackPalette = ['#5bc0de', '#f0ad4e', '#7f8cfa', '#7bdcb5', '#ff8b94'];

const UiLineGraph: React.FC<UiLineGraphProps> = ({
    data,
    variant = 'grid',
    traits,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateDimensions = () => {
            const { width, height } = container.getBoundingClientRect();
            setDimensions({ width, height });
        };

        updateDimensions();

        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, []);

    const { width, height } = dimensions;
    const strokeWidth = traits?.strokeWidth ?? 2;
    const padding = traits?.padding ?? 12;
    const m = { t: padding, r: padding, b: padding + 12, l: padding + 28 };
    const iw = Math.max(1, width - m.l - m.r);
    const ih = Math.max(1, height - m.t - m.b);

    const series = useMemo(() => {
        const entries = Object.entries(data || {});
        return entries.map(([key, value], idx) => {
            const asSeries = Array.isArray(value)
                ? { points: value as Point[] }
                : (value as Series);
            return {
                key,
                label: asSeries.label || key,
                color: asSeries.color || fallbackPalette[idx % fallbackPalette.length],
                points: (asSeries.points || []).filter(p =>
                    Number.isFinite(p?.x) && Number.isFinite(p?.y)
                ),
            };
        });
    }, [data]);

    const extent = useMemo(() => {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        let allNonNegative = true;
        series.forEach(s => {
            s.points.forEach(p => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
                if (p.y < 0) allNonNegative = false;
            });
        });
        if (!Number.isFinite(minX) || minX === maxX) {
            minX = 0;
            maxX = 1;
        }
        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
            minY = 0;
            maxY = 1;
        } else if (minY === maxY) {
            const base = Math.abs(minY);
            const delta = Math.max(0.05, base * 0.15);
            minY = minY - delta;
            maxY = maxY + delta;
        }
        const padY = Math.max(0.005, (maxY - minY) * 0.05);
        const minWithPad = allNonNegative ? Math.max(0, minY - padY) : (minY - padY);
        return {
            minX,
            maxX,
            minY: minWithPad,
            maxY: maxY + padY,
        };
    }, [series]);

    const scaleX = (x: number) =>
        m.l + ((x - extent.minX) / Math.max(1e-9, extent.maxX - extent.minX)) * iw;
    const scaleY = (y: number) =>
        m.t + (1 - (y - extent.minY) / Math.max(1e-9, extent.maxY - extent.minY)) * ih;

    const gridYValues = useMemo(() => {
        const steps = 4;
        const span = extent.maxY - extent.minY;
        return Array.from({ length: steps + 1 }, (_, i) => extent.minY + (span * i) / steps);
    }, [extent]);

    const formatYTick = React.useCallback((value: number) => {
        const span = Math.abs(extent.maxY - extent.minY);
        const maxAbs = Math.max(Math.abs(extent.minY), Math.abs(extent.maxY));

        let decimals = 0;
        if (span < 0.1 || maxAbs < 0.1) decimals = 3;
        else if (span <= 1 || maxAbs < 1) decimals = 2;
        else if (span <= 10 || maxAbs < 10) decimals = 1;

        if (decimals === 0) return String(Math.round(value));

        const fixed = value.toFixed(decimals);
        return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    }, [extent.maxY, extent.minY]);

    const background = traits?.background || 'transparent';

    if (!series.length || series.every(s => s.points.length === 0)) {
        return (
            <div ref={containerRef} className="ui-line-graph__empty" style={{ width: '100%', height: '100%' }}>
                <style jsx>{styles}</style>
                <div className="ui-line-graph__empty-text">No data</div>
            </div>
        );
    }

    if (width === 0 || height === 0) {
        return (
            <div ref={containerRef} className="ui-line-graph" style={{ width: '100%', height: '100%' }}>
                <style jsx>{styles}</style>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="ui-line-graph" style={{ width: '100%', height: '100%' }}>
            <style jsx>{styles}</style>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                style={{ display: 'block', width: '100%', height: '100%', background }}
            >
                {variant === 'grid' && (
                    <g className="ui-line-graph__grid">
                        {gridYValues.map((v, i) => {
                            const y = scaleY(v);
                            return (
                                <g key={i}>
                                    <line x1={m.l} y1={y} x2={m.l + iw} y2={y} strokeOpacity={0.18} />
                                    <text x={4} y={y + 4} fontSize={10} fill="#888">
                                        {formatYTick(v)}
                                    </text>
                                </g>
                            );
                        })}
                        <line x1={m.l} y1={m.t + ih} x2={m.l + iw} y2={m.t + ih} strokeOpacity={0.28} />
                    </g>
                )}

                {series.map(s => {
                    const path = s.points
                        .map((p, idx) => `${idx ? 'L' : 'M'} ${scaleX(p.x)} ${scaleY(p.y)}`)
                        .join(' ');
                    return (
                        <g key={s.key}>
                            <path d={path} fill="none" stroke={s.color} strokeWidth={strokeWidth} />
                            {traits?.showDots &&
                                s.points.map((p, idx) => (
                                    <circle
                                        key={idx}
                                        cx={scaleX(p.x)}
                                        cy={scaleY(p.y)}
                                        r={strokeWidth + 1}
                                        fill={s.color}
                                    />
                                ))}
                            {s.points[0] && (
                                <text
                                    x={m.l + 4}
                                    y={scaleY(s.points[0].y) - 6}
                                    fontSize={11}
                                    fill={s.color}
                                    className="ui-line-graph__series-label"
                                >
                                    {s.label || s.key}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export default UiLineGraph;