import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getService } from "@webstack/common";
import { useNotification } from "@webstack/components/Notification/Notification";
import { useUser } from "~/src/core/authentication/hooks/useUser";
import IMemberService, { IUserLocationPayload } from "~/src/core/services/MemberService/IMemberService";
import useLocalStorage from "@webstack/hooks/storage/useLocalStorage";
import { GuardianFix, GuardianState } from "./types";
import {
  DEFAULT_UPLOAD_INTERVAL,
  LOCAL_TRACKING_STATE,
  MIN_BACKEND_DISTANCE_METERS,
  STALE_FIX_MS,
  STORAGE_KEYS,
  UPLOAD_INTERVALS,
} from "./tracker/types";
import {
  metersBetween,
  normalizeDeviceIdentifier,
  normalizeDeviceLabel,
  normalizeFix,
  resolveSpeedMph,
} from "./tracker/helpers";
import { buildDescriptor, hydrateDescriptor, persistDescriptor } from "./tracker/device";
type CoreArgs = { onFix?: (fix: GuardianFix) => void };
const GEO_TIMEOUT_MS = 20000;
const normalizeId = (value?: string | null) => normalizeDeviceIdentifier(value) || undefined;
const normalizeLabel = (value?: string | null) => normalizeDeviceLabel(value) || undefined;
const useGuardianTrackerCore = ({ onFix }: CoreArgs = {}) => {
  const user = useUser();
  const userId = user?.id || (user as any)?.memberId;
  const memberService = useMemo(() => getService<IMemberService>("IMemberService"), []);
  const [notification, setNotification] = useNotification();
  const { setLocalItem, getLocalItem } = useLocalStorage("guardian:tracking");
  const shareStorage = useLocalStorage("guardian:shareDeviceId");

  const [state, setState] = useState<GuardianState>({ tracking: false, status: "idle" });
  const [deviceDescriptor, setDeviceDescriptor] = useState<ReturnType<typeof buildDescriptor> | null>(null);
  const [deviceFixes, setDeviceFixes] = useState<Record<string, GuardianFix>>({});
  const [uploadIntervalSec, setUploadIntervalSec] = useState<number>(DEFAULT_UPLOAD_INTERVAL);
  const [trackingResumePending, setTrackingResumePending] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastPushRef = useRef(0);
  const lastBackendFixRef = useRef<GuardianFix | null>(null);
  const stateRef = useRef(state);
  const lastGeoFixRef = useRef<GuardianFix | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const notifyError = useCallback(
    (label: string, message: string) => {
      setNotification({
        active: true,
        persistence: 800,
        dismissable: true,
        list: [{ label, message }],
      });
    },
    [setNotification]
  );
  const ensureDevice = useCallback(() => {
    if (deviceDescriptor) return deviceDescriptor;
    const stored = hydrateDescriptor(getLocalItem);
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    const descriptor = stored ?? buildDescriptor(getLocalItem?.(STORAGE_KEYS.device), nav);
    setDeviceDescriptor(descriptor);
    persistDescriptor(descriptor, setLocalItem);
    return descriptor;
  }, [deviceDescriptor, getLocalItem, setLocalItem]);

  // Eagerly hydrate or create a device descriptor on load so other
  // Guardian hooks can rely on a stable device id by default.
  useEffect(() => {
    ensureDevice();
  }, [ensureDevice]);

  const persistActive = useCallback(
    (value: boolean) => {
      setLocalItem?.(LOCAL_TRACKING_STATE, value);
      if (!value) setTrackingResumePending(false);
    },
    [setLocalItem]
  );
  const persistFix = useCallback(
    (fix: GuardianFix, opts?: { backendSync?: boolean }) => {
      const descriptor = ensureDevice();
      const timestamp = fix.timestamp || Date.now();
      const displayTimestamp = fix.displayTimestamp || Date.now();
      const deviceId = normalizeId(fix.deviceId || descriptor.id) || descriptor.id;
      const deviceLabel = normalizeLabel(fix.deviceLabel || descriptor.label || deviceId) || deviceId;
      const normalized: GuardianFix = {
        ...fix,
        timestamp,
        displayTimestamp,
        deviceId,
        deviceLabel,
        deviceType: fix.deviceType || descriptor.type,
        deviceInfo: {
          ...(descriptor.info || {}),
          ...(fix.deviceInfo || {}),
          deviceId,
          deviceLabel,
        },
        userId: fix.userId || userId,
        recordedAt: timestamp,
        recorded_at: timestamp,
      };
      setDeviceFixes((prev) => ({ ...prev, [deviceId]: normalized }));
      setState((prev) => ({
        ...prev,
        lastFix: normalized,
        lastBackendSync: opts?.backendSync ? Date.now() : prev.lastBackendSync,
        status: prev.tracking ? "tracking" : prev.status,
        tracking: prev.tracking,
        permission: "granted",
        error: undefined,
      }));
      setLocalItem?.(STORAGE_KEYS.fix, { userId: userId, ...normalized });
      onFix?.(normalized);
      return normalized;
    },
    [ensureDevice, onFix, setLocalItem, userId]
  );
  const pushToBackend = useCallback(
    (fix: GuardianFix) => {
      if (!userId) return;
      const now = Date.now();
      const effectiveIntervalSec = Math.max(3, uploadIntervalSec || 0);
      if (now - lastPushRef.current < effectiveIntervalSec * 1000 - 200) return;
      const descriptor = ensureDevice();
      const deviceId = normalizeId(fix.deviceId || descriptor.id) || descriptor.id;
      const deviceLabel = normalizeLabel(fix.deviceLabel || descriptor.label || deviceId) || deviceId;
      const deviceType = fix.deviceType || descriptor.type;
      const deviceInfo = { ...(descriptor.info || {}), ...(fix.deviceInfo || {}), deviceId, deviceLabel };
      const shareDeviceId =
        typeof shareStorage?.localItem === "string"
          ? normalizeId(shareStorage.localItem)
          : undefined;
      const isSharedDevice = Boolean(
        shareDeviceId && (deviceId === shareDeviceId || normalizeId(deviceLabel) === shareDeviceId)
      );
      const speedMph = Number.isFinite(fix.speedMph ?? NaN)
        ? Number(fix.speedMph)
        : undefined;
      const payload: IUserLocationPayload = {
        userId,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        timestamp: new Date(fix.timestamp || Date.now()).toISOString(),
        deviceId,
        deviceLabel,
        deviceType,
        device_info: deviceInfo,
        deviceInfo,
        speedMph,
        isSharedDevice,
      };
      lastPushRef.current = now;
      memberService
        .updateUserLocation(payload)
        .then(() => {
          lastBackendFixRef.current = { ...fix, deviceId };
          setState((prev) => ({
            ...prev,
            lastBackendSync: Date.now(),
            status: prev.tracking ? "tracking" : prev.status,
          }));
        })
        .catch((err: any) => {
          const msg = err?.message || "Unable to sync location.";
          setState((prev) => ({ ...prev, status: "error", error: msg, tracking: false }));
          notifyError("Location sync failed", msg);
        });
    },
    [
      ensureDevice,
      memberService,
      notifyError,
      shareStorage?.localItem,
      uploadIntervalSec,
      userId,
    ]
  );

  const handleGeoSuccess = useCallback(
    (pos: GeolocationPosition) => {
      if (!userId) return;
      const descriptor = ensureDevice();
      const now = Date.now();
      const baseFix: GuardianFix = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: now,
        deviceId: descriptor.id,
        deviceLabel: descriptor.label,
        deviceType: descriptor.type,
        deviceInfo: descriptor.info,
        userId,
      };
      const speed = resolveSpeedMph(
        {
          speed: pos.coords.speed ?? undefined,
          speed_mps: pos.coords.speed ?? undefined,
          timestamp: baseFix.timestamp,
          latitude: baseFix.latitude,
          longitude: baseFix.longitude,
          accuracy: pos.coords.accuracy,
        },
        lastGeoFixRef.current ?? stateRef.current.lastFix
      );
      if (speed !== undefined) baseFix.speedMph = speed;
      lastGeoFixRef.current = baseFix;
      const normalized = persistFix(baseFix);
      pushToBackend(normalized);
    },
    [ensureDevice, persistFix, pushToBackend, userId]
  );

  const handleGeoError = useCallback(
    (err: GeolocationPositionError) => {
      const isDenied = err?.code === err.PERMISSION_DENIED;
      const message =
        isDenied && err?.message
          ? err.message
          : isDenied
            ? "Location permission denied. Enable location to track."
            : err?.message || "Unable to read location.";

      if (isDenied) {
        setTrackingResumePending(true);
        persistActive(false);
        setState((prev) => ({
          ...prev,
          tracking: false,
          status: "error",
          permission: "denied",
          error: message,
        }));
        notifyError("Location error", message);
        return;
      }

      // For transient errors/timeouts, stay in tracking state and keep retrying.
      persistActive(true);
      setState((prev) => ({
        ...prev,
        tracking: true,
        status: "tracking",
        error: undefined,
      }));
    },
    [notifyError, persistActive]
  );

  const startTracking = useCallback(
    (deviceInfo?: any) => {
      if (!userId) {
        notifyError("Sign in required", "Log in before starting tracking.");
        setState((prev) => ({ ...prev, tracking: false, status: "error", error: "Sign in required." }));
        return;
      }
      // Prevent duplicate watch registrations
      if (stateRef.current.tracking && watchIdRef.current !== null) {
        setState((prev) => ({ ...prev, status: "tracking", error: undefined }));
        return;
      }
      const descriptor = ensureDevice();
      const merged = { ...descriptor, info: { ...(descriptor.info || {}), ...(deviceInfo || {}) } };
      setDeviceDescriptor(merged);
      persistDescriptor(merged, setLocalItem);
      setState((prev) => ({ ...prev, tracking: true, status: "requesting", error: undefined }));
      setTrackingResumePending(false);
      persistActive(true);
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        notifyError("Unavailable", "Geolocation is not supported in this browser.");
        setState((prev) => ({ ...prev, tracking: false, status: "error" }));
        return;
      }
      try {
        const id = navigator.geolocation.watchPosition(handleGeoSuccess, handleGeoError, {
          enableHighAccuracy: true,
          maximumAge: uploadIntervalSec * 1000,
          timeout: GEO_TIMEOUT_MS,
        });
        watchIdRef.current = id;
        // seed an immediate fix while watch settles
        navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, {
          enableHighAccuracy: true,
          maximumAge: uploadIntervalSec * 1000,
          timeout: GEO_TIMEOUT_MS,
        });
      } catch (err: any) {
        const message = err?.message || "Unable to start tracking.";
        notifyError("Tracking error", message);
        setState((prev) => ({ ...prev, tracking: false, status: "error", error: message }));
      }
    },
    [ensureDevice, handleGeoError, handleGeoSuccess, notifyError, persistActive, setLocalItem, uploadIntervalSec, userId]
  );

  const stopTracking = useCallback(
    (nextStatus: GuardianState["status"] = "idle", opts?: { persistActive?: boolean }) => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") {
        try {
          navigator.geolocation?.clearWatch(watchIdRef.current);
        } catch {
          /* ignore */
        }
      }
      watchIdRef.current = null;
      if (!opts?.persistActive) persistActive(false);
      setTrackingResumePending(false);
      setState((prev) => ({ ...prev, tracking: false, status: nextStatus }));
    },
    [persistActive]
  );

  useEffect(() => {
    const stored = Number(getLocalItem?.(STORAGE_KEYS.upload));
    if (Number.isFinite(stored) && UPLOAD_INTERVALS.includes(stored)) {
      setUploadIntervalSec(stored);
    }
  }, [getLocalItem]);

  useEffect(() => {
    const bounded = UPLOAD_INTERVALS.includes(uploadIntervalSec)
      ? uploadIntervalSec
      : DEFAULT_UPLOAD_INTERVAL;
    if (bounded !== uploadIntervalSec) {
      setUploadIntervalSec(bounded);
      return;
    }
    setLocalItem?.(STORAGE_KEYS.upload, bounded);
  }, [setLocalItem, uploadIntervalSec]);

  useEffect(() => {
    const descriptor = ensureDevice();
    const storedFix = getLocalItem?.(STORAGE_KEYS.fix);
    if (storedFix && (!storedFix.userId || storedFix.userId === userId)) {
      const normalized = normalizeFix(storedFix, userId);
      if (normalized) {
        persistFix(normalized, { backendSync: true });
        setDeviceFixes((prev) => ({ ...prev, [normalized.deviceId || descriptor.id]: normalized }));
      }
    }
  }, [ensureDevice, getLocalItem, persistFix, userId]);
  useEffect(() => {
    const persisted = getLocalItem?.(LOCAL_TRACKING_STATE);
    const shouldResume = Boolean(persisted) && Boolean(userId) && !state.tracking;
    setTrackingResumePending(shouldResume);
    if (!shouldResume) return;
    startTracking();
  }, [getLocalItem, startTracking, state.tracking, userId]);

  // Watchdog: if tracking but no fresh geo events, request one-off fix to refresh
  useEffect(() => {
    if (!state.tracking) return;
    const interval = setInterval(() => {
      const last = lastGeoFixRef.current || stateRef.current.lastFix;
      const lastTs = last?.timestamp || 0;
      if (!lastTs || Date.now() - lastTs > uploadIntervalSec * 2000) {
        try {
          navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, {
            enableHighAccuracy: true,
            maximumAge: uploadIntervalSec * 1000,
            timeout: GEO_TIMEOUT_MS,
          });
        } catch {
          /* ignore */
        }
      }
    }, uploadIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [handleGeoError, handleGeoSuccess, state.tracking, uploadIntervalSec]);
  useEffect(() => {
    return () => {
      stopTracking("idle", { persistActive: stateRef.current.tracking });
    };
  }, [stopTracking]);

  const staleFix = useMemo(() => {
    const ts = state.lastFix?.timestamp;
    return ts ? Date.now() - ts > STALE_FIX_MS : false;
  }, [state.lastFix?.timestamp]);

  return {
    state,
    staleFix,
    trackingResumePending,
    deviceDescriptor,
    deviceFixes,
    uploadIntervalSec,
    setUploadIntervalSec,
    startTracking,
    stopTracking,
    persistFix,
    setDeviceFixes,
  };
};

export default useGuardianTrackerCore;
