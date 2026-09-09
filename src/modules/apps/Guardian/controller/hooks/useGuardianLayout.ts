import { useCallback, useEffect, useRef, useState } from "react";
import useLocalStorage from "@webstack/hooks/storage/useLocalStorage";
import { GuardianViewMode } from "../../hooks/useGuardian";
import { GuardianVesselScope } from "../../hooks/types";

type GuardianSettings = {
  vesselScope: GuardianVesselScope;
  deviceTypeFilter: string;
  mapOrientation: "north" | "heading";
  viewMode: GuardianViewMode;
  panelWidth: number;
};

const SETTINGS_KEY = "guardian:settings";
const DEFAULT_SETTINGS: GuardianSettings = {
  vesselScope: "all",
  deviceTypeFilter: "",
  mapOrientation: "north",
  viewMode: "live",
  panelWidth: 750,
};

const useGuardianLayout = (width?: number | null) => {
  const desktopMode = width == null ? true : width > 1100;
  const { localItem, setLocalItem, getLocalItem } = useLocalStorage(SETTINGS_KEY);
  const hydratedRef = useRef(false);
  const [settings, setSettings] = useState<GuardianSettings>(() => {
    const stored = (typeof window !== "undefined" ? getLocalItem?.(SETTINGS_KEY) : null) as
      | Partial<GuardianSettings>
      | null
      | undefined;
    return stored && typeof stored === "object"
      ? { ...DEFAULT_SETTINGS, ...stored }
      : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    if (hydratedRef.current) {
      if (localItem) {
        setSettings((prev) => ({ ...prev, ...(localItem as GuardianSettings) }));
      }
      return;
    }
    if (localItem) {
      setSettings((prev) => ({ ...prev, ...(localItem as GuardianSettings) }));
    }
    hydratedRef.current = true;
  }, [localItem]);

  const updateSetting = useCallback((patch: Partial<GuardianSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (!setLocalItem || !hydratedRef.current) return;
    setLocalItem(SETTINGS_KEY, settings);
  }, [setLocalItem, settings]);

  return {
    desktopMode,
    settings,
    updateSetting,
  };
};

export default useGuardianLayout;
