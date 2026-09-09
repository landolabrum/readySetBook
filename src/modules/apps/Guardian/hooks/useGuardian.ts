import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getService } from "@webstack/common";
import IMemberService from "~/src/core/services/MemberService/IMemberService";
import { useUser } from "~/src/core/authentication/hooks/useUser";
import { GuardianFix } from "./types";
import { dedupeTimeline, normalizeDeviceIdentifier, normalizeFix } from "./tracker/helpers";
import useGuardianTrackerCore from "./useGuardianTrackerCore";

export type GuardianViewMode = "live" | "timeline";

const POLL_INTERVAL_MS = 3000;
const TIMELINE_LIMIT = 1000;

const useGuardianTracker = () => {
  const user = useUser();
  const memberService = useMemo(() => getService<IMemberService>("IMemberService"), []);
  const [timeline, setTimeline] = useState<GuardianFix[]>([]);
  const userId = user?.id || (user as any)?.memberId;
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineEnabled, setTimelineEnabled] = useState(false);
  const pollInFlightRef = useRef(false);

  const handleFix = useCallback(
    (fix: GuardianFix) => {
      if (!timelineEnabled) return;
      setTimeline((prev) => dedupeTimeline([...prev, fix]));
    },
    [timelineEnabled]
  );

  const {
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
  } = useGuardianTrackerCore({ onFix: handleFix });
  const lastFixRef = useRef<GuardianFix | undefined>(undefined);
  useEffect(() => {
    lastFixRef.current = state.lastFix;
  }, [state.lastFix]);

  const refreshTimeline = useCallback(
    async (options?: { force?: boolean; userId?: string; limit?: number }) => {
      const targetUser = options?.userId || userId;
      if (!targetUser) return;
      if (!timelineEnabled && !options?.force) return;
      setTimelineLoading(true);
      try {
        const res = await memberService.getUserTimeline(targetUser, {
          limit: Math.min(options?.limit ?? TIMELINE_LIMIT, TIMELINE_LIMIT),
        });
        const rows = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : res?.data
              ? [res.data]
              : [];
        const fixes = rows.map((row: any) => normalizeFix(row, targetUser)).filter(Boolean) as GuardianFix[];
        const merged = dedupeTimeline(fixes);
        setTimeline(merged);
        if (merged.length) {
          const latestByDevice = new Map<string, GuardianFix>();
          merged.forEach((point) => {
            const id = point.deviceId || "primary";
            const existing = latestByDevice.get(id);
            if (!existing || point.timestamp > existing.timestamp) {
              latestByDevice.set(id, { ...point, displayTimestamp: Date.now() });
            }
          });
          setDeviceFixes((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Array.from(latestByDevice.entries()).map(([id, fix]) => {
                const existing = prev[id];
                const existingTs = existing?.timestamp ?? 0;
                const nextTs = fix.timestamp ?? 0;
                return [id, nextTs >= existingTs ? fix : existing];
              })
            ),
          }));
          const newest = merged[merged.length - 1];
          if (newest && !lastFixRef.current) {
            persistFix(newest, { backendSync: true });
          }
        }
        return merged;
      } finally {
        setTimelineLoading(false);
      }
    },
    [memberService, persistFix, setDeviceFixes, timelineEnabled, userId]
  );

  const removeDevice = useCallback(
    (deviceId?: string) => {
      const normalized = normalizeDeviceIdentifier(deviceId) || "";
      if (!normalized) return;
      setDeviceFixes((prev) => {
        const next = { ...prev };
        delete next[normalized];
        return next;
      });
      setTimeline((prev) =>
        prev.filter((point) => {
          const id = normalizeDeviceIdentifier(point.deviceId || point.deviceLabel || "primary");
          return id !== normalized;
        })
      );
    },
    [setDeviceFixes]
  );

  useEffect(() => {
    if (!userId) return;
    const poll = async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const thisDeviceId = deviceDescriptor?.id?.trim();
        let res: any;
        try {
          res = await memberService.getUserLocation(userId, thisDeviceId || undefined);
        } catch (err: any) {
          const status = err?.statusCode ?? err?.status ?? err?.response?.status;
          if (status === 404) return;
          throw err;
        }
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : res?.data
              ? [res.data]
              : [];
        if (!list.length) return;
        const fixes = list.map((row: any) => normalizeFix(row, userId)).filter(Boolean) as GuardianFix[];
        if (!fixes.length) return;
        const latestByDevice = new Map<string, GuardianFix>();
        fixes.forEach((f) => {
          const deviceId = f.deviceId || f.deviceLabel || "primary";
          const existing = latestByDevice.get(deviceId);
          if (!existing || f.timestamp > existing.timestamp) {
            latestByDevice.set(deviceId, { ...f, displayTimestamp: Date.now() });
          }
        });
        const heartbeatNow = Date.now();
        const newestBase = Array.from(latestByDevice.values()).sort((a, b) => b.timestamp - a.timestamp)[0];
        const newest = newestBase ? { ...newestBase, displayTimestamp: heartbeatNow } : undefined;
        if (newest) {
          const current = lastFixRef.current;
          const currentTs = current?.timestamp ?? 0;
          const newestTs = newest.timestamp ?? 0;
          const shouldRefresh = !current || newestTs >= currentTs;
          const fixToPersist = shouldRefresh ? newest : { ...current, displayTimestamp: heartbeatNow };
          persistFix(fixToPersist, { backendSync: true });
        }
        setDeviceFixes((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Array.from(latestByDevice.entries()).map(([id, fix]) => {
              const existing = prev[id];
              const existingTs = existing?.timestamp ?? 0;
              const nextTs = fix.timestamp ?? 0;
              const base = nextTs >= existingTs ? fix : existing;
              return [id, base ? { ...base, displayTimestamp: heartbeatNow } : base];
            })
          ),
        }));
        if (timelineEnabled) {
          setTimeline((prev) => dedupeTimeline([...prev, ...Array.from(latestByDevice.values())]));
        }
      } finally {
        pollInFlightRef.current = false;
      }
    };
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      pollInFlightRef.current = false;
    };
  }, [memberService, persistFix, setDeviceFixes, state.tracking, timelineEnabled, userId]);

  return {
    tracking: state.tracking,
    status: state.status,
    permission: state.permission,
    lastFix: state.lastFix,
    lastBackendSync: state.lastBackendSync,
    error: state.error,
    timeline,
    timelineLoading,
    devices: Object.values(deviceFixes).sort((a, b) => b.timestamp - a.timestamp),
    deviceId: deviceDescriptor?.id,
    deviceLabel: deviceDescriptor?.label,
    deviceType: deviceDescriptor?.type,
    deviceInfo: deviceDescriptor?.info,
    refreshTimeline,
    removeDevice,
    uploadIntervalSec,
    setUploadIntervalSec,
    startTracking,
    stopTracking,
    staleFix,
    setTimelineEnabled,
    trackingResumePending,
  };
};

export const useGaurdianTracker = useGuardianTracker;
export default useGuardianTracker;
export type { GuardianFix, GuardianState, TrackerStatus } from "./types";
