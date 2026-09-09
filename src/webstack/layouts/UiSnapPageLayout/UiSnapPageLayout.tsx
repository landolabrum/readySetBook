// Relative Path: ./UiSnapPageLayout.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import styles from './UiSnapPageLayout.scss';

export interface IUiSnapPageLayout {
    /** Index of the view to scroll into sight (controlled). */
    currentViewIndex?: number;
    /** Array of views – each rendered as a full-viewport snap section. */
    views: React.ReactNode[];
    /** Fires when the visible view changes (via user scroll or programmatic trigger). */
    onViewChange?: (index: number) => void;
    /** Scroll axis – defaults to vertical. */
    direction?: 'vertical' | 'horizontal';
    /** Persistent header pinned above the snap area. */
    header?: React.ReactNode;
    /** Persistent footer pinned below the snap area. */
    footer?: React.ReactNode;
}

const UiSnapPageLayout: React.FC<IUiSnapPageLayout> = ({
    currentViewIndex = 0,
    views,
    onViewChange,
    direction = 'vertical',
    header,
    footer,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);
    const activeIndexRef = useRef(currentViewIndex);

    // Keep the ref in sync so the observer callback always sees the latest.
    activeIndexRef.current = currentViewIndex;

    // ── Lock body scroll while this layout is mounted ────────────────────
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    // ── Programmatic scroll when currentViewIndex changes ────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const target = container.children[currentViewIndex] as HTMLElement | undefined;
        if (!target) return;

        isScrollingRef.current = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });

        // Unlock user-driven detection after the smooth scroll settles.
        const timer = setTimeout(() => {
            isScrollingRef.current = false;
        }, 700);
        return () => clearTimeout(timer);
    }, [currentViewIndex, views.length]);

    // ── Observe which section is most visible and report changes ─────────
    const handleIntersect = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            if (isScrollingRef.current) return;
            for (const entry of entries) {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
                    const idx = Number((entry.target as HTMLElement).dataset.snapIndex);
                    if (!Number.isNaN(idx) && idx !== activeIndexRef.current) {
                        onViewChange?.(idx);
                    }
                }
            }
        },
        [onViewChange],
    );

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(handleIntersect, {
            root: container,
            threshold: [0.55],
        });

        // Only observe <section> snap children, not header/footer
        container.querySelectorAll<HTMLElement>('[data-snap-index]').forEach((child) =>
            observer.observe(child),
        );
        return () => observer.disconnect();
    }, [views.length, handleIntersect]);

    const dirClass =
        direction === 'horizontal'
            ? 'snap-page--horizontal'
            : 'snap-page--vertical';

    const hasHeader = !!header;
    const hasFooter = !!footer;
    const wrapperClass = [
        'snap-page-wrapper',
        hasHeader ? 'snap-page-wrapper--has-header' : '',
        hasFooter ? 'snap-page-wrapper--has-footer' : '',
    ].filter(Boolean).join(' ');

    return (
        <>
            <style jsx>{styles}</style>
            <div className={wrapperClass}>
                {header && <div className="snap-page__header">{header}</div>}
                <div ref={containerRef} className={`snap-page ${dirClass}`}>
                    {views.map((view, index) => (
                        <section
                            key={index}
                            data-snap-index={index}
                            className={`snap-page__section${index === currentViewIndex ? ' snap-page__section--active' : ''
                                }`}
                        >
                            {view}
                        </section>
                    ))}
                </div>
                {footer && <div className="snap-page__footer">{footer}</div>}
            </div>
        </>
    );
};

export default UiSnapPageLayout;