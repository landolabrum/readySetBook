import { useCallback, useRef } from "react";
import type { OverlayType, CanonOverlay } from "@Canopy/models/canopyOverlayTypes";
import { coerceEnabled } from "@Canopy/models/canopyOverlayTypes";
import { clamp01, pickValue, setDeep, toFloatOrUndef } from "../../../functions/overlayHelpers";
import type { OverlayPatch } from "../../../functions/overlayControlTypes";

type Args = {
  setOverlays: (next: any) => void;
  lsKey?: string;
  setOverlayLS: (name: string, val: any) => void;
  eventId?: string;
  saveOverlaysById?: (eventId: string, payload: any[]) => Promise<boolean>;
};

type Result = {
  patch: OverlayPatch;
  onChangeFor: (overlay: CanonOverlay) => (e: any) => void;
  onChangeTicker: (overlay: CanonOverlay) => (e: any) => void;
  onAddTickerField: (overlay: CanonOverlay) => (e: any) => void;
};

const PIPELINE_AUTO_SAVE_FIELDS = new Set([
  "data.pipelineSessionId",
  "data.src",
  "data.streamKey",
  "data.rtmpIngestUrl",
  "data.sourceContext",
]);
const SHARE_OVERLAY_TYPES = new Set(["camera", "screen", "encoder", "pull"]);

export const useOverlayEventHandlers = ({
  setOverlays,
  lsKey,
  setOverlayLS,
  eventId,
  saveOverlaysById,
}: Args): Result => {
  const pipelineAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch: OverlayPatch = useCallback((id, type, name, value) => {
    setOverlays((prev: CanonOverlay[]) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      if (!id) return prev;
      const idx = list.findIndex((o) => o.id === id);
      if (idx < 0) return prev;
      const base = list[idx];
      const baseEnabled = base.enabled === undefined ? true : coerceEnabled(base.enabled);

      const CROP_IDX: Record<string, number> = { crop_top: 0, crop_bottom: 1, crop_left: 2, crop_right: 3 };
      if (name in CROP_IDX) {
        const n = Number(value);
        const v = Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n)) * 100) / 100 : 0;
        const prev = Array.isArray(base.crop) && base.crop.length >= 4
          ? base.crop as [number, number, number, number]
          : ([0, 0, 0, 0] as [number, number, number, number]);
        const newCrop = [...prev] as [number, number, number, number];
        newCrop[CROP_IDX[name]] = v;
        const updated = { ...base, crop: newCrop.every(x => x === 0) ? undefined : newCrop };
        const next = list.slice();
        next[idx] = { ...updated, enabled: baseEnabled };
        if (lsKey) setOverlayLS(lsKey, next);
        return next;
      }

      const nextVal = (() => {
        if (name === "x" || name === "y" || name === "width" || name === "height") return clamp01(value);
        if (name === "z_index") return Number(value) || 0;
        if (name.startsWith("data.")) return value;
        if (name === "title" || name === "description") return String(value ?? "");
        return value;
      })();

      const updated = name.startsWith("data.") ? setDeep(base, name, nextVal) : { ...base, [name]: nextVal };
      const next = list.slice();
      next[idx] = { ...updated, enabled: baseEnabled };

      if (lsKey) setOverlayLS(lsKey, next);
      if (eventId && saveOverlaysById && SHARE_OVERLAY_TYPES.has(type) && PIPELINE_AUTO_SAVE_FIELDS.has(name)) {
        if (pipelineAutoSaveRef.current) clearTimeout(pipelineAutoSaveRef.current);
        pipelineAutoSaveRef.current = setTimeout(() => {
          void saveOverlaysById(String(eventId), next as any).catch(() => {});
          pipelineAutoSaveRef.current = null;
        }, 500);
      }
      return next;
    });
  }, [setOverlays, lsKey, setOverlayLS, eventId, saveOverlaysById]);

  const onChangeFor = useCallback((overlay: CanonOverlay) => (e: any) => {
    const { id, type } = overlay;
    if (Array.isArray(e)) {
      if (type === "ticker") patch(id, type, "data.items", e);
      else if (type === "media") patch(id, type, "data.urls", e);
      return;
    }

    const t = e?.target ?? e;
    const name: string | undefined = t?.name;
    if (!name) return;
    const val = pickValue(t?.type === "checkbox" ? !!t?.checked : t?.value);

    if (type === "lapcounter" && (name === "data.currentLap" || name === "data.totalLaps")) {
      const num = Number(val);
      patch(id, type, name, Number.isFinite(num) ? num : name === "data.totalLaps" ? 0 : 1);
      return;
    }
    if (type === "map" && name === "data.manualCenter") return patch(id, type, name, !!val);
    if (type === "map" && name === "data.userId") return patch(id, type, name, String(val ?? "").trim() || null);

    const applyLocation = (fieldName: string, latitude?: number, longitude?: number) => {
      setOverlays((prev: CanonOverlay[]) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        if (!id) return prev;
        const idx = list.findIndex((o) => o.id === id);
        if (idx < 0) return prev;
        const base = list[idx];
        let updated = { ...base } as any;
        if (latitude != null) updated = setDeep(updated, "data.lat", latitude);
        if (longitude != null) {
          if (type === "hud") updated = setDeep(updated, "data.lon", longitude);
          updated = setDeep(updated, "data.lng", longitude);
        }
        updated = setDeep(updated, fieldName, val);
        const next = list.slice();
        next[idx] = { ...updated, enabled: base.enabled === undefined ? true : coerceEnabled(base.enabled) };
        if (lsKey) setOverlayLS(lsKey, next);
        return next;
      });
    };

    if (name === "data.location" && val && typeof val === "object") {
      return applyLocation("data.address", toFloatOrUndef((val as any).lat), toFloatOrUndef((val as any).lng));
    }
    if (type === "map" && (name === "data.address" || name.endsWith(".address")) && val && typeof val === "object") {
      const lat = toFloatOrUndef((val as any).lat);
      const lng = toFloatOrUndef((val as any).lng);
      if (lat != null || lng != null) return applyLocation(name, lat, lng);
    }

    patch(id, type, name, val);
  }, [patch, setOverlays, lsKey, setOverlayLS]);

  const onChangeTicker = useCallback((overlay: CanonOverlay) => (e: any) => onChangeFor(overlay)(e), [onChangeFor]);

  const onAddTickerField = useCallback((overlay: CanonOverlay) => (e: any) => {
    const raw = String(e?.target?.value ?? "").trim();
    if (!raw) return;
    setOverlays((prev: CanonOverlay[]) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex((o) => o.id === overlay.id);
      const base = idx >= 0 ? list[idx] : overlay;
      const cur: string[] = Array.isArray(base?.data?.items) ? base.data.items : [];
      if (cur.includes(raw)) return prev;
      const next = list.slice();
      next[idx >= 0 ? idx : next.length] = setDeep(base, "data.items", [...cur, raw]);
      if (lsKey) setOverlayLS(lsKey, next);
      return next;
    });
  }, [setOverlays, lsKey, setOverlayLS]);

  return { patch, onChangeFor, onChangeTicker, onAddTickerField };
};
