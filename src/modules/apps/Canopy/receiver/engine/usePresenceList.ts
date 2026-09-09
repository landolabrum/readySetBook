import React from "react";
import { type Overlay, type PresentItem } from "./types";
import { normType } from "./utils";

const FADE_MS = 500;

export function usePresenceList(renderables: Overlay[]) {
  const [present, setPresent] = React.useState<PresentItem[]>([]);
  const missingCountsRef = React.useRef<Map<string, number>>(new Map());

  const keyedRenderables = React.useMemo(() => {
    const counts = new Map<string, number>();
    return renderables.map((o) => {
      const id = o?.id != null ? String(o.id) : "";
      const t = normType(o?.type);
      const key = id || (() => {
        const n = (counts.get(t) || 0) + 1;
        counts.set(t, n);
        return `${t}#${n}`;
      })();
      return { key, ov: o };
    });
  }, [renderables]);

  React.useEffect(() => {
    setPresent((prev) => {
      const newKeys = new Set(keyedRenderables.map((k) => k.key));
      const prevKeys = new Set(prev.map((p) => p.key));

      const staying: PresentItem[] = prev
        .filter((p) => newKeys.has(p.key))
        .map((p) => ({ key: p.key, ov: (keyedRenderables.find((o) => o.key === p.key)!).ov, state: "stay" }));
      for (const s of staying) missingCountsRef.current.delete(s.key);

      const exiting: PresentItem[] = [];
      for (const p of prev) {
        if (newKeys.has(p.key) || p.state === "exit") continue;
        const c = (missingCountsRef.current.get(p.key) || 0) + 1;
        missingCountsRef.current.set(p.key, c);
        if (c >= 2) exiting.push({ ...p, state: "exit" as const });
      }
      if (exiting.length) {
        window.setTimeout(() => {
          setPresent((cur) => cur.filter((ci) => ci.state !== "exit"));
        }, FADE_MS);
      }

      const entering: PresentItem[] = keyedRenderables
        .filter(({ key }) => !prevKeys.has(key))
        .map(({ key, ov }) => ({ key, ov, state: "enter" as const }));

      return [...staying, ...exiting, ...entering];
    });
  }, [keyedRenderables]);

  React.useEffect(() => {
    if (!present.some((p) => p.state === "enter")) return;
    const id = window.setTimeout(() => {
      setPresent((cur) => cur.map((p) => (p.state === "enter" ? { ...p, state: "stay" } : p)));
    }, 16);
    return () => window.clearTimeout(id);
  }, [present]);

  return present;
}

