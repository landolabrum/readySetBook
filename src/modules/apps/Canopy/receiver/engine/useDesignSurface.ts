import React from "react";

export function useDesignSurface(designW: number, designH: number) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const parentRect = el.parentElement?.getBoundingClientRect();

      // Prefer the element's own box, then fall back to parent sizing before window.
      const w = rect?.width || parentRect?.width || (el as any).clientWidth || el.parentElement?.clientWidth || 0;
      const h = rect?.height || parentRect?.height || (el as any).clientHeight || el.parentElement?.clientHeight || 0;

      if (!w || !h) return; // keep previous scale if not measurable yet

      const s = Math.min(w / designW, h / designH);
      setScale(Number.isFinite(s) && s > 0 ? s : 1);
    };

    // compute after layout settles
    const r1 = requestAnimationFrame(() => {
      compute();
      const r2 = requestAnimationFrame(compute);
      (compute as any)._r2 = r2;
    });

    let ro: ResizeObserver | null = null;
    if ((window as any).ResizeObserver) {
      ro = new (window as any).ResizeObserver(compute);
      ro?.observe(el);
    }

    const onWin = () => compute();
    window.addEventListener("resize", onWin);

    return () => {
      window.removeEventListener("resize", onWin);
      if (ro) ro.disconnect();
      cancelAnimationFrame(r1);
      if ((compute as any)._r2) cancelAnimationFrame((compute as any)._r2);
    };
  }, [designW, designH]);

  return { containerRef, scale } as const;
}
