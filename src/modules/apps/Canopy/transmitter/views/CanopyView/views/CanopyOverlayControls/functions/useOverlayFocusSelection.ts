import { useMemo } from "react";
import type { CanonOverlay } from "@Canopy/models/canopyOverlayTypes";
import type { FocusSelection } from "../../../functions/overlayControlTypes";

type Args = {
  focusIdOverride?: string;
  meta: any;
  metaKey?: string;
  getMetaLS?: (name: string) => any;
  displayOverlays: CanonOverlay[];
  allOverlays: CanonOverlay[];
  overlays: CanonOverlay[];
};

export const useOverlayFocusSelection = ({
  focusIdOverride,
  meta,
  metaKey,
  getMetaLS,
  displayOverlays,
  allOverlays,
  overlays,
}: Args): FocusSelection => {
  return useMemo(() => {
    const sameId = (a: any, b: any) => a != null && b != null && String(a) === String(b);
    let focusId = focusIdOverride || ((meta as any)?.t as string | undefined);

    if (!focusId && metaKey) {
      try {
        const raw = getMetaLS?.(metaKey) as any;
        const val = raw && typeof raw === "object" && "value" in raw ? (raw as any).value : raw;
        if (val && typeof val === "object" && typeof val.t === "string") focusId = val.t;
      } catch {
        // ignore storage read issues
      }
    }

    if (!focusId && displayOverlays.length > 0) {
      const first = displayOverlays.find(Boolean);
      focusId = first?.id;
    }

    const focusOverlay = focusId
      ? displayOverlays.find((o) => sameId(o?.id, focusId))
        || allOverlays.find((o) => sameId(o?.id, focusId))
        || overlays.find((o) => sameId(o?.id, focusId))
      : undefined;

    return { focusId, focusOverlay };
  }, [focusIdOverride, meta, metaKey, getMetaLS, displayOverlays, allOverlays, overlays]);
};
