import {
  defaultCardItem,
  type CardBindingMode,
  type CardBindingSelectorType,
  type CardBindingSource,
  type CardOverlayItem,
} from "@Canopy/models/canopyOverlayTypes";

export const addTemplateItem = (
  items: CardOverlayItem[],
  kind: "stat" | "image" | "banner",
) => {
  const seq = items.length + 1;
  const seed =
    kind === "image"
      ? defaultCardItem({
        title: `Visual ${seq}`,
        value: "Headline",
        subtitle: "Image + text",
        imageUrl: "https://picsum.photos/320/180",
        colSpan: 2,
        background: "#19263b",
      })
      : kind === "banner"
        ? defaultCardItem({
          title: `Banner ${seq}`,
          value: "Key Insight",
          subtitle: "Fast context for commentators",
          colSpan: 3,
          background: "linear-gradient(90deg,#8f1212,#b71c1c)",
        })
        : defaultCardItem({
          title: `Stat ${seq}`,
          value: "32",
          subtitle: "Sample metric",
          background: "#121f35",
        });

  const next = [...items, seed];
  return { next, nextIndex: next.length - 1 };
};

export const removeActiveItem = (items: CardOverlayItem[], activeIdx: number) => {
  const next = items.filter((_, idx) => idx !== activeIdx);
  const safeNext = next.length ? next : [defaultCardItem({ title: "Headline", value: "Ready" })];
  return { next: safeNext, nextIndex: Math.max(0, activeIdx - 1) };
};

export const duplicateActiveItem = (items: CardOverlayItem[], activeIdx: number) => {
  const cur = items[activeIdx] ?? defaultCardItem();
  const dup = defaultCardItem({ ...cur, id: undefined, title: `${cur.title || "Item"} Copy` });
  const next = [...items.slice(0, activeIdx + 1), dup, ...items.slice(activeIdx + 1)];
  return { next, nextIndex: activeIdx + 1 };
};

export const moveActiveItem = (items: CardOverlayItem[], activeIdx: number, direction: -1 | 1) => {
  const target = activeIdx + direction;
  if (target < 0 || target >= items.length) return { next: items, nextIndex: activeIdx };
  const next = [...items];
  const [moved] = next.splice(activeIdx, 1);
  next.splice(target, 0, moved);
  return { next, nextIndex: target };
};

export const moveItemByIndex = (items: CardOverlayItem[], from: number, to: number) => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export const quickPairActiveItem = (
  items: CardOverlayItem[],
  activeIdx: number,
  source: CardBindingSource,
  key: string,
  mode?: CardBindingMode,
) => {
  const selectorType: CardBindingSelectorType | undefined =
    source === "gps"
      ? "first_available"
      : source === "event_team" && mode === "record"
        ? "leader"
        : undefined;

  return items.map((it, idx) => {
    if (idx !== activeIdx) return it;
    const base = items[activeIdx] ?? defaultCardItem();
    return {
      ...base,
      binding: {
        ...(base.binding || {}),
        source,
        mode: mode ?? (source === "event_team" ? "aggregate" : source === "gps" ? "record" : "aggregate"),
        key,
        selector: selectorType ? { type: selectorType, value: "" } : undefined,
      },
    };
  });
};
