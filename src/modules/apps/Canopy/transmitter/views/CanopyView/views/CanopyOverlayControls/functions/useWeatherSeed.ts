import { useEffect, useRef } from "react";
import { defaultOverlayFor } from "@Canopy/models/canopyOverlayTypes";
import type { CanonOverlay } from "@Canopy/models/canopyOverlayTypes";

type Args = {
  showWeather: boolean;
  allOverlays: CanonOverlay[];
  setOverlays: (next: any) => void;
  currentName?: string;
  lsKey?: string;
  setOverlayLS: (name: string, val: any) => void;
};

export const useWeatherSeed = ({
  showWeather,
  allOverlays,
  setOverlays,
  currentName,
  lsKey,
  setOverlayLS,
}: Args) => {
  const weatherInitRef = useRef(false);

  useEffect(() => {
    if (weatherInitRef.current || !showWeather) return;

    const weatherOverlay = allOverlays.find((o) => o.type === "weather");
    const latNum = typeof weatherOverlay?.data?.lat === "number"
      ? weatherOverlay.data.lat
      : parseFloat(weatherOverlay?.data?.lat as any);
    const lngNum = typeof weatherOverlay?.data?.lng === "number"
      ? weatherOverlay.data.lng
      : parseFloat(weatherOverlay?.data?.lng as any);

    if (Number.isFinite(latNum) && Number.isFinite(lngNum) && latNum !== 0 && lngNum !== 0) {
      weatherInitRef.current = true;
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    weatherInitRef.current = true;
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setOverlays((prev: CanonOverlay[]) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((o) => o.type === "weather");
        const base = idx >= 0 ? list[idx] : defaultOverlayFor("weather", currentName);
        const updated = { ...base, data: { ...(base.data || {}), lat, lng } };
        const next = list.slice();
        if (idx >= 0) next[idx] = updated; else next.push(updated);
        if (lsKey) setOverlayLS(lsKey, next);
        return next;
      });
    }, () => {}, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }, [showWeather, allOverlays, setOverlays, currentName, lsKey, setOverlayLS]);
};
