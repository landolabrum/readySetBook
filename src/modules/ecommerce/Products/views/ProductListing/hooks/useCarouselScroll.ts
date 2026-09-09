import { useRef, useState, useCallback, useEffect } from "react";

export interface UseCarouselScrollOptions {
    autoScroll?: boolean;
    speed?: number;
}

export interface UseCarouselScrollReturn {
    carouselRef: React.RefObject<HTMLDivElement>;
    canScrollLeft: boolean;
    canScrollRight: boolean;
    scrollLeft: () => void;
    scrollRight: () => void;
    pauseAuto: () => void;
    resumeAuto: () => void;
}

const useCarouselScroll = (
    enabled: boolean,
    deps: React.DependencyList = [],
    options: UseCarouselScrollOptions = {},
): UseCarouselScrollReturn => {
    const { autoScroll = false, speed = 0.01 } = options;
    const carouselRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const pausedRef = useRef(false);
    const rafRef = useRef<number | null>(null);

    const updateArrows = useCallback(() => {
        const el = carouselRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft + el.offsetWidth < el.scrollWidth - 1);
    }, []);

    const scroll = useCallback(
        (direction: "left" | "right") => {
            const el = carouselRef.current;
            if (!el) return;
            const amount = el.offsetWidth * 0.8;
            el.scrollBy({
                left: direction === "right" ? amount : -amount,
                behavior: "smooth",
            });
            setTimeout(updateArrows, 350);
        },
        [updateArrows],
    );

    const scrollLeft = useCallback(() => scroll("left"), [scroll]);
    const scrollRight = useCallback(() => scroll("right"), [scroll]);

    const pauseAuto = useCallback(() => { pausedRef.current = true; }, []);
    const resumeAuto = useCallback(() => { pausedRef.current = false; }, []);

    useEffect(() => {
        const el = carouselRef.current;
        if (!el || !enabled) return;
        updateArrows();
        el.addEventListener("scroll", updateArrows, { passive: true });
        return () => el.removeEventListener("scroll", updateArrows);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, updateArrows, ...deps]);

    useEffect(() => {
        const el = carouselRef.current;
        if (!el || !enabled || !autoScroll) return;

        let last = performance.now();
        let pos = el.scrollLeft;
        let dir: 1 | -1 = 1;
        const syncFromUser = () => { pos = el.scrollLeft; };
        el.addEventListener("scroll", syncFromUser, { passive: true });

        const MIN_OVERFLOW = 24;

        const tick = (now: number) => {
            const dt = now - last;
            last = now;
            const max = el.scrollWidth - el.clientWidth;
            if (!pausedRef.current && max > MIN_OVERFLOW) {
                pos += speed * dt * dir;
                if (pos >= max) { pos = max; dir = -1; }
                else if (pos <= 0) { pos = 0; dir = 1; }
                if (Math.floor(pos) !== el.scrollLeft) {
                    el.removeEventListener("scroll", syncFromUser);
                    el.scrollLeft = pos;
                    el.addEventListener("scroll", syncFromUser, { passive: true });
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            el.removeEventListener("scroll", syncFromUser);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, autoScroll, speed, ...deps]);

    return { carouselRef, canScrollLeft, canScrollRight, scrollLeft, scrollRight, pauseAuto, resumeAuto };
};

export default useCarouselScroll;
