import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import { GuardianViewMode } from "../../hooks/useGuardian";
import {
  buildLiveVessels,
  buildLookupVessels,
  buildTimelineVessels,
  dedupeVessels,
  selectGuardianVessels,
} from "../../utils/vessels";
import { useDebounce } from "../../utils/optimization";
import { GuardianFix, GuardianVesselScope } from "../../hooks/types";
import useGuardianFleet from "./useGuardianFleet";
import { isVesselActivelyTracking, isVesselOnline, resolveLastSeen } from "../../utils/vesselCommon";
type GuardianDeps = {
  guardian: any;
  user: any;
  memberService: any;
  viewMode: GuardianViewMode;
  onUpdateSetting: (patch: Partial<{ viewMode: GuardianViewMode }>) => void;
  initialVesselScope: GuardianVesselScope;
  initialDeviceTypeFilter: string;
  friendVessels: IVessel[];
  shareDeviceId: string | null;
  setShareDeviceId?: (val: string | null) => void;
  friendNameForId: (id?: string) => string;
  requestLocation: any;
  guestLngLat?: [number, number];
};

const normalizeId = (val?: string) => (val ?? "").trim();
const resolveClearanceLevel = (user: any): number => {
  const candidates = [
    user?.metadata?.user?.clearance,
    user?.metadata?.user?.clearance_level,
    user?.metadata?.user?.clearanceLevel,
    user?.metadata?.clearance,
    user?.metadata?.clearance_level,
    user?.metadata?.clearanceLevel,
    user?.clearance,
    user?.clearance_level,
    user?.clearanceLevel,
    (user as any)?.user?.clearance,
    (user as any)?.user?.clearance_level,
    (user as any)?.user?.clearanceLevel,
    (user as any)?.claims?.metadata?.user?.clearance,
    (user as any)?.claims?.metadata?.user?.clearance_level,
    (user as any)?.claims?.metadata?.user?.clearanceLevel,
  ];
  for (const value of candidates) {
    if (value == null) continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return 0;
};
const ensureGuardianMarkerClass = (className?: string) => {
  if (!className) return "guardian__marker";
  return className.includes("guardian__marker")
    ? className
    : ["guardian__marker", className].filter(Boolean).join(" ");
};

const withTrackingMeta = (vessel: IVessel): IVessel => {
  const meta = (vessel as IVessel & { meta?: any }).meta ?? {};
  const lastSeen = resolveLastSeen(meta);
  return {
    ...vessel,
    className: ensureGuardianMarkerClass(vessel.className),
    meta: {
      ...meta,
      lastSeen,
      isTracking: true,
    },
  };
};

const useGuardianDataState = ({
  guardian,
  user,
  memberService,
  viewMode,
  onUpdateSetting,
  initialVesselScope,
  initialDeviceTypeFilter,
  friendVessels,
  shareDeviceId,
  setShareDeviceId,
  friendNameForId,
  requestLocation,
  guestLngLat,
}: GuardianDeps) => {
  const currentUserId = user?.id || (user as any)?.memberId;
  const [userNameCache, setUserNameCache] = useState<Record<string, string>>({});
  const rememberUserName = useCallback((id?: string, label?: string | null) => {
    const key = normalizeId(id);
    const value = (label ?? "").trim();
    if (!key || !value) return;
    setUserNameCache((prev) => {
      if (prev[key] === value) return prev;
      return { ...prev, [key]: value };
    });
  }, []);
  const resolveDisplayName = useCallback(
    (id?: string) => {
      const key = normalizeId(id);
      if (!key) return "";
      return userNameCache[key] || friendNameForId(key) || "";
    },
    [friendNameForId, userNameCache]
  );
  const [viewUserId, setViewUserId] = useState("");
  const [viewDeviceId, setViewDeviceId] = useState("");
  const [lookupVessel, setLookupVessel] = useState<IVessel | null>(null);
  const [lookupNote, setLookupNote] = useState<{ tone: "info" | "error"; message: string } | null>(null);
  const [mapCenter, setMapCenterState] = useState<[number, number] | undefined>();
  const [mapZoom, setMapZoom] = useState<number | undefined>(15);
  const mapCenterRef = useRef<[number, number] | undefined>(undefined);
  const [adminVessels, setAdminVessels] = useState<IVessel[]>([]);
  const [adminPage, setAdminPage] = useState(1);
  const [adminPageSize, setAdminPageSize] = useState(25);
  const [adminTotal, setAdminTotal] = useState(0);
  const [adminDenied, setAdminDenied] = useState(false);
  const [vesselScope, setVesselScope] = useState<GuardianVesselScope>(initialVesselScope);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState(initialDeviceTypeFilter);
  const [vesselSearch, setVesselSearch] = useState("");
  const vesselSearchDebounced = useDebounce(vesselSearch, 250);
  const { fleetVessels, fleetLoading } = useGuardianFleet({ enabled: vesselScope === "fleet" });
  const lookupCacheRef = useRef<Map<string, IVessel[]>>(new Map());
  const clearanceLevel = resolveClearanceLevel(user);
  const urlToken = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("token");
  }, []);
  const canAdminFetch =
    (clearanceLevel ?? 0) >= 12 ||
    Boolean(urlToken) ||
    (Boolean(currentUserId) && !adminDenied);
  const adminScopeAutoSetRef = useRef(false);
  const lastTimelineFetchRef = useRef(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const adminFetchInFlightRef = useRef(false);
  const adminPollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const adminPollConfigRef = useRef({ page: 1, pageSize: 25 });
  const adminPollFetchRef = useRef<null | (() => void)>(null);
  const ensureDisplayNamesRef = useRef<typeof ensureDisplayNamesFn | null>(null);
  const resolveDisplayNameRef = useRef<typeof resolveDisplayName | null>(null);
  const rememberUserNameRef = useRef<typeof rememberUserName | null>(null);
  const buildFallbackRef = useRef<() => any[]>(() => []);
  const buildFallbackFromDevices = useCallback(
    () =>
      guardian.devices?.map((fix: GuardianFix) => {
        const labelOwner = resolveDisplayName(fix.userId || currentUserId) || user?.name || "You";
        rememberUserName(fix.userId || currentUserId, labelOwner);
        return {
          user_id: fix.userId || currentUserId,
          device_id: fix.deviceId || fix.deviceLabel,
          device_label: fix.deviceLabel || fix.deviceId,
          device_type: fix.deviceType || fix.deviceInfo?.deviceType,
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
          recorded_at: fix.timestamp || fix.displayTimestamp || Date.now(),
          device_info: fix.deviceInfo || {},
          speed_mph: fix.speedMph,
          friend_display_name: labelOwner,
        };
      }) || [],
    [currentUserId, guardian.devices, rememberUserName, resolveDisplayName, user?.name]
  );

  const ensureDisplayNamesFn = useCallback(
    async (rows: any[]) => {
      if (!Array.isArray(rows) || !rows.length) return {};
      const discovered: Record<string, string> = {};
      const missing: string[] = [];
      rows.forEach((row) => {
        const uid = normalizeId(row?.user_id || row?.userId || row?.friend_user_id || row?.friendUserId);
        if (!uid) return;
        const label =
          row?.friend_display_name ||
          row?.displayName ||
          row?.display_name ||
          row?.user_name ||
          row?.name;
        if (label) {
          discovered[uid] = label;
          rememberUserName(uid, label);
        } else if (!resolveDisplayName(uid)) {
          missing.push(uid);
        }
      });
      const uniqueMissing = Array.from(new Set(missing));
      if (!uniqueMissing.length) return discovered;
      const fetched: Record<string, string> = {};
      await Promise.all(
        uniqueMissing.map(async (uid) => {
          try {
            const profile = await memberService.getMemberProfileInformation(uid);
            const label =
              profile?.name ||
              profile?.displayName ||
              profile?.display_name ||
              profile?.fullName ||
              profile?.member?.name ||
              profile?.user?.name;
            if (label) {
              fetched[uid] = label;
              rememberUserName(uid, label);
            }
          } catch {
            /* ignore missing profile */
          }
        })
      );
      return { ...discovered, ...fetched };
    },
    [memberService, rememberUserName, resolveDisplayName]
  );

  useEffect(() => {
    ensureDisplayNamesRef.current = ensureDisplayNamesFn;
  }, [ensureDisplayNamesFn]);
  useEffect(() => {
    resolveDisplayNameRef.current = resolveDisplayName;
  }, [resolveDisplayName]);
  useEffect(() => {
    rememberUserNameRef.current = rememberUserName;
  }, [rememberUserName]);
  useEffect(() => {
    buildFallbackRef.current = () => buildFallbackFromDevices();
  }, [buildFallbackFromDevices]);
  useEffect(() => {
    adminPollConfigRef.current = { page: adminPage, pageSize: adminPageSize };
    if (canAdminFetch) {
      adminPollFetchRef.current?.();
    }
  }, [adminPage, adminPageSize, canAdminFetch]);

  // If the signed-in user changes (or token access changes), re-attempt admin access.
  useEffect(() => {
    setAdminDenied(false);
  }, [currentUserId, urlToken]);

  // Admins should see all vessels on initial load; don't let a persisted "mine"
  // setting hide other users' devices.
  useEffect(() => {
    if ((clearanceLevel ?? 0) < 12) return;
    if (adminScopeAutoSetRef.current) return;
    adminScopeAutoSetRef.current = true;
    setVesselScope("all");
  }, [clearanceLevel]);

  const setMapCenter = useCallback(
    (center?: [number, number], opts?: { force?: boolean; zoom?: number }) => {
      if (!center) {
        mapCenterRef.current = undefined;
        setMapCenterState(undefined);
        return;
      }
      const [lon, lat] = center;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      const prev = mapCenterRef.current;
      const changed =
        opts?.force ||
        !prev ||
        Math.abs(prev[0] - lon) > 1e-5 ||
        Math.abs(prev[1] - lat) > 1e-5;
      if (!changed) return;
      mapCenterRef.current = [lon, lat];
      setMapCenterState([lon, lat]);
      if (opts?.zoom != null) setMapZoom(opts.zoom);
    },
    []
  );
  const enableAutoFollow = useCallback(() => setAutoFollow(true), []);
  const disableAutoFollow = useCallback(() => setAutoFollow(false), []);
  useEffect(() => {
    setVesselScope(initialVesselScope);
  }, [initialVesselScope]);
  useEffect(() => {
    setDeviceTypeFilter(initialDeviceTypeFilter);
  }, [initialDeviceTypeFilter]);

  useEffect(() => {
    if (currentUserId && user?.name) {
      rememberUserName(currentUserId, user.name);
    }
  }, [currentUserId, rememberUserName, user?.name]);

  // Seed center from guest coordinates when available to avoid an empty map on auth transition.
  useEffect(() => {
    if (!mapCenter && guestLngLat) {
      setMapCenter(guestLngLat, { zoom: mapZoom ?? 14 });
    }
  }, [guestLngLat, mapCenter, mapZoom, setMapCenter]);

  const ownerName = useMemo(() => {
    const resolved = resolveDisplayName(currentUserId);
    return resolved || user?.name || undefined;
  }, [currentUserId, resolveDisplayName, user?.name]);

  useEffect(() => {
    if (guardian.lastFix?.userId) {
      rememberUserName(guardian.lastFix.userId, ownerName || user?.name || "You");
    }
  }, [guardian.lastFix?.userId, ownerName, rememberUserName, user?.name]);

  const fallbackVessels = useMemo(() => {
    const coords = mapCenter ?? guestLngLat;
    const hasOwnData = Boolean(guardian.lastFix || guardian.devices?.length || guardian.timeline?.length);
    const showFallback = Boolean(coords) && !hasOwnData;
    if (!showFallback) return [];
    const [lng, lat] = coords as [number, number];
    const isGuest = !currentUserId;
    const displayName = user?.name || (isGuest ? "You (guest)" : "You");
    const deviceLabel = guardian.deviceLabel || guardian.deviceId || (isGuest ? "Guest device" : "This device");
    const deviceType = guardian.deviceType || guardian.deviceInfo?.deviceType || (isGuest ? "browser" : "device");
    return [
      {
        id: isGuest ? "guest-device" : currentUserId || "user-device",
        name: `${displayName} · ${deviceLabel}`,
        lngLat: coords as [number, number],
        className: "guardian__marker guardian__marker--guest",
        active: true,
        icon: "fa-map-pin",
        isMain: true,
        meta: {
          userId: isGuest ? "guest" : currentUserId,
          deviceId: guardian.deviceId || (isGuest ? "guest" : "primary"),
          deviceLabel,
          deviceType,
          displayName,
          lastSeen: Date.now(),
        },
        hover: (
          <div className="guardian__marker-hover">
            <div>{displayName}</div>
            <div className="guardian__marker-device">
              <span>{deviceLabel}</span>
              <span>{deviceType}</span>
            </div>
            <div>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
            <div>Last seen: just now</div>
          </div>
        ),
      } as IVessel,
    ];
  }, [currentUserId, guardian.deviceId, guardian.deviceInfo, guardian.deviceLabel, guardian.deviceType, guardian.devices?.length, guardian.lastFix, guardian.timeline?.length, guestLngLat, mapCenter, user?.name]);

  useEffect(() => {
    if (!canAdminFetch) {
      adminPollFetchRef.current = null;
      if (adminPollTimeoutRef.current) {
        clearTimeout(adminPollTimeoutRef.current);
        adminPollTimeoutRef.current = null;
      }
      adminFetchInFlightRef.current = false;
      setAdminVessels([]);
      setAdminTotal(0);
      return;
    }
    let cancelled = false;
    let timeout: NodeJS.Timeout | null = null;
    let shouldContinuePolling = true;

    const scheduleNext = () => {
      if (cancelled) return;
      if (!shouldContinuePolling) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        void run();
      }, 30000);
      adminPollTimeoutRef.current = timeout;
    };

    const run = async () => {
      if (adminFetchInFlightRef.current || cancelled) return;
      adminFetchInFlightRef.current = true;
      try {
        const { page, pageSize } = adminPollConfigRef.current;
        const fetchAdminLocations = async (p: number, ps: number) => {
          if (typeof memberService?.getAdminUserLocations === "function") {
            return memberService.getAdminUserLocations(p, ps);
          }
          const rawGet = (memberService as any)?.get;
          if (typeof rawGet === "function") {
            const qs = new URLSearchParams();
            qs.set("page", String(p));
            qs.set("page_size", String(ps));
            if (urlToken) qs.set("token", urlToken);
            const suffix = qs.toString() ? `?${qs.toString()}` : "";
            return rawGet.call(memberService, `api/gps/admin/locations${suffix}`);
          }
          throw new Error("Admin locations fetch unavailable");
        };

        const res: any = await fetchAdminLocations(page, pageSize);
        if (cancelled) return;
        const rows: any[] = Array.isArray(res?.data) ? res.data : [];
        const ensureNames = ensureDisplayNamesRef.current;
        const nameMap = ensureNames ? await ensureNames(rows) : {};
        if (cancelled) return;
        const resolveName = resolveDisplayNameRef.current || (() => "");
        const enrichedRows = rows.map((row: any) => {
          const uid = normalizeId(row?.user_id || row?.userId || row?.friend_user_id || row?.friendUserId);
          const friendly =
            row?.friend_display_name ||
            nameMap[uid] ||
            resolveName(uid) ||
            row?.displayName ||
            row?.display_name ||
            row?.user_name ||
            row?.name ||
            uid;
          return {
            ...row,
            friend_display_name: friendly,
          };
        });
        setAdminVessels(buildLookupVessels(enrichedRows));
        const total = Number(res?.total ?? rows.length ?? 0);
        if (!Number.isNaN(total)) setAdminTotal(total);
      } catch (err: any) {
        const status =
          err?.status ||
          err?.statusCode ||
          err?.response?.status ||
          err?.response?.data?.status ||
          err?.detail?.status;
        if (status === 401 || status === 403) {
          shouldContinuePolling = false;
          setAdminDenied(true);
          setAdminVessels([]);
          setAdminTotal(0);
          return;
        }
        if (process?.env?.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("[guardian] admin locations fetch failed", err);
        }
        const fallbackRows = buildFallbackRef.current?.() || [];
        if (fallbackRows.length) {
          const resolveName = resolveDisplayNameRef.current || (() => "");
          const remember = rememberUserNameRef.current || (() => undefined);
          const fallbackNames = fallbackRows.map((row: any) => {
            const label = resolveName(row.user_id) || row.user_id;
            remember(row.user_id, label);
            return {
              ...row,
              friend_display_name: label,
            };
          });
          setAdminVessels(buildLookupVessels(fallbackNames));
          setAdminTotal(fallbackRows.length);
        } else {
          setAdminTotal(0);
        }
      } finally {
        adminFetchInFlightRef.current = false;
        scheduleNext();
      }
    };

    adminPollFetchRef.current = () => {
      if (timeout) clearTimeout(timeout);
      adminPollTimeoutRef.current = null;
      timeout = null;
      void run();
    };

    void run();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      adminPollTimeoutRef.current = null;
      adminPollFetchRef.current = null;
    };
  }, [canAdminFetch, memberService, urlToken]);

  useEffect(() => {
    if (!canAdminFetch) return;
    if (adminVessels.length) return;
    const fallbackRows = buildFallbackFromDevices();
    if (!fallbackRows.length) return;
    const fallbackNames = fallbackRows.map((row: any) => {
      const label = resolveDisplayName(row.user_id) || row.user_id;
      rememberUserName(row.user_id, label);
      return {
        ...row,
        friend_display_name: label,
      };
    });
    setAdminVessels(buildLookupVessels(fallbackNames));
    setAdminTotal(fallbackNames.length);
  }, [adminVessels.length, buildFallbackFromDevices, canAdminFetch, rememberUserName, resolveDisplayName]);

  useEffect(() => {
    guardian.setTimelineEnabled(viewMode === "timeline");
    if (viewMode === "timeline" && currentUserId) {
      const now = Date.now();
      if (now - lastTimelineFetchRef.current > 5000) {
        lastTimelineFetchRef.current = now;
        void guardian.refreshTimeline({ force: true, userId: currentUserId });
      }
    }
  }, [currentUserId, guardian.refreshTimeline, guardian.setTimelineEnabled, viewMode]);

  // When a device is selected (?device=), the map should follow only that
  // device instead of whichever device reported most recently.
  const selectedDeviceId = normalizeId(viewDeviceId || shareDeviceId || "").toLowerCase();
  const matchesSelectedDevice = useCallback(
    (fix?: GuardianFix | null) => {
      if (!selectedDeviceId) return true;
      if (!fix) return false;
      const id = normalizeId(fix.deviceId).toLowerCase();
      const label = normalizeId(fix.deviceLabel).toLowerCase();
      return id === selectedDeviceId || label === selectedDeviceId;
    },
    [selectedDeviceId]
  );
  const timelineCenteredRef = useRef(false);
  useEffect(() => {
    timelineCenteredRef.current = false;
  }, [selectedDeviceId, viewMode]);

  useEffect(() => {
    if (viewMode === "live") {
      const focusFix = selectedDeviceId
        ? (guardian.devices || []).find(matchesSelectedDevice)
        : guardian.lastFix;
      const hasFix = focusFix?.longitude != null && focusFix?.latitude != null;
      if (!hasFix) return;
      const shouldFollow = selectedDeviceId
        ? autoFollow
        : autoFollow && (guardian.tracking || !mapCenter);
      if (shouldFollow) {
        setMapCenter([focusFix.longitude, focusFix.latitude]);
      }
      return;
    }
    if (viewMode === "timeline" && guardian.timeline?.length) {
      const points = selectedDeviceId
        ? guardian.timeline.filter(matchesSelectedDevice)
        : guardian.timeline;
      const latest = points[points.length - 1];
      if (!latest) return;
      // Without a selected device the newest point alternates between
      // devices every poll; center once instead of chasing it.
      if (!selectedDeviceId && timelineCenteredRef.current) return;
      timelineCenteredRef.current = true;
      setMapCenter([latest.longitude, latest.latitude]);
    }
  }, [
    autoFollow,
    guardian.devices,
    guardian.lastFix,
    guardian.timeline,
    guardian.tracking,
    mapCenter,
    matchesSelectedDevice,
    selectedDeviceId,
    setMapCenter,
    viewMode,
  ]);

  const adminFiltered = useMemo(() => {
    const ownedIds = new Set<string>();
    [...(guardian.devices || []), guardian.lastFix]
      .filter(Boolean)
      .forEach((d: any) => {
        const id = d?.deviceId || d?.deviceLabel;
        if (id) ownedIds.add(id);
      });

    return adminVessels.filter((v) => {
      const meta = (v as IVessel & { meta?: any }).meta || {};
      const metaDeviceId = meta.deviceId || meta.deviceLabel;
      if (currentUserId && meta.userId === currentUserId) return false;
      if (ownedIds.has(metaDeviceId)) return false;
      if (guardian.deviceId && metaDeviceId === guardian.deviceId) return false;
      if (guardian.deviceLabel && metaDeviceId === guardian.deviceLabel) return false;
      return true;
    });
  }, [adminVessels, currentUserId, guardian.devices, guardian.deviceId, guardian.deviceLabel, guardian.lastFix]);

  useEffect(() => {
    (friendVessels || []).forEach((v) => {
      const meta = (v as IVessel & { meta?: any }).meta;
      if (meta?.userId && meta?.displayName) rememberUserName(meta.userId, meta.displayName);
    });
  }, [friendVessels, rememberUserName]);

  useEffect(() => {
    adminVessels.forEach((v) => {
      const meta = (v as IVessel & { meta?: any }).meta;
      if (meta?.userId && meta?.displayName) rememberUserName(meta.userId, meta.displayName);
    });
  }, [adminVessels, rememberUserName]);

  useEffect(() => {
    fallbackVessels.forEach((v) => {
      const meta = (v as IVessel & { meta?: any }).meta;
      if (meta?.userId && meta?.displayName) rememberUserName(meta.userId, meta.displayName);
    });
  }, [fallbackVessels, rememberUserName]);

  const liveVessels = useMemo(
    () =>
      buildLiveVessels({
        devices: guardian.devices,
        lastFix: guardian.lastFix,
        tracking: guardian.tracking,
        status: guardian.status,
        userName: ownerName,
        lookupVessel,
        allVessels: dedupeVessels([...friendVessels, ...adminFiltered, ...fallbackVessels]),
        shareDeviceId,
        activeDeviceId: guardian.deviceId ?? guardian.deviceLabel ?? undefined,
      }),
    [
      adminFiltered,
      friendVessels,
      fallbackVessels,
      guardian.devices,
      guardian.lastFix,
      guardian.tracking,
      guardian.status,
      guardian.deviceId,
      guardian.deviceLabel,
      guardian.deviceType,
      guardian.deviceInfo,
      lookupVessel,
      shareDeviceId,
      ownerName,
    ]
  );

  const timelineVessels = useMemo(
    () =>
      buildTimelineVessels({
        timeline: guardian.timeline,
        viewMode,
        tracking: guardian.tracking,
        status: guardian.status,
        userName: user?.name,
      }),
    [guardian.status, guardian.timeline, guardian.tracking, user?.name, viewMode]
  );

  const vessels = useMemo(
    () => {
      // Fleet scope swaps the vessel source entirely; ownership scoping is
      // enforced server-side by /gps/fleet/locations (admins see all).
      if (vesselScope === "fleet") return fleetVessels;
      const base = selectGuardianVessels(viewMode, timelineVessels, liveVessels);
      return fallbackVessels.length ? dedupeVessels([...base, ...fallbackVessels]) : base;
    },
    [fallbackVessels, fleetVessels, liveVessels, timelineVessels, vesselScope, viewMode]
  );

  const deviceTypeOptions = useMemo(() => {
    const types = new Set<string>();
    vessels.forEach((v) => {
      const metaDeviceType = (v as IVessel & { meta?: any }).meta?.deviceType;
      const normalized = (metaDeviceType ?? "").toString().toLowerCase();
      if (normalized) types.add(normalized);
    });
    return Array.from(types).sort();
  }, [vessels]);

  const filteredVessels = useMemo(() => {
    const searchQuery = vesselSearchDebounced.trim().toLowerCase();
    const typeFilter = deviceTypeFilter.trim().toLowerCase();
    const isFleet = vesselScope === "fleet";
    const isMine = vesselScope === "mine";
    const filtered = vessels.filter((v) => {
      const meta = (v as IVessel & { meta?: any }).meta ?? {};
      if (isMine && currentUserId && meta?.userId && meta.userId !== currentUserId) return false;
      if (searchQuery) {
        const candidates = [v.name, meta.displayName, meta.userId, meta.deviceId].filter(Boolean) as string[];
        if (!candidates.some((value) => value.toLowerCase().includes(searchQuery))) return false;
      }
      if (typeFilter) {
        const deviceType = (meta?.deviceType ?? "").toString().toLowerCase();
        if (deviceType !== typeFilter) return false;
      }
      return true;
    });
    if (!isFleet && lookupVessel && !filtered.some((v) => v.id === lookupVessel.id)) {
      return [...filtered, lookupVessel];
    }
    return filtered;
  }, [currentUserId, deviceTypeFilter, lookupVessel, vesselScope, vessels, vesselSearchDebounced]);

  const trackingVessels = useMemo(() => {
    if (viewMode !== "live") return [];
    const now = Date.now();
    return vessels
      .filter((v) => {
        const hasCoords =
          Array.isArray(v.lngLat) &&
          v.lngLat.length === 2 &&
          Number.isFinite(Number(v.lngLat[0])) &&
          Number.isFinite(Number(v.lngLat[1]));
        if (!hasCoords) return false;
        return isVesselOnline(v as any, now) && isVesselActivelyTracking(v as any, now);
      })
      .map(withTrackingMeta);
  }, [vessels, viewMode]);

  const statusLabel = useMemo(() => {
    if (guardian.staleFix && guardian.lastFix) return "Stale fix";
    if (guardian.tracking && guardian.status === "tracking") return "Tracking";
    if (guardian.status === "requesting") return "Requesting permission…";
    if (guardian.status === "error") return "Error";
    return "Idle";
  }, [guardian.lastFix, guardian.staleFix, guardian.status, guardian.tracking]);

  const handleLookup = useCallback(
    async (userId?: string, device?: string) => {
      const targetId = normalizeId(userId ?? viewUserId);
      const targetDevice = (device ?? viewDeviceId).trim();
      if (!targetId) return;
      setViewUserId(targetId);
      setViewDeviceId(targetDevice);
      setLookupNote(null);
      const cacheKey = `${targetId}:${targetDevice || "primary"}`;
      const cached = lookupCacheRef.current.get(cacheKey);
      const apply = (items: IVessel[]) => {
        if (items.length) {
          setLookupVessel(items[0]);
          setMapCenter(items[0].lngLat as [number, number]);
          lookupCacheRef.current.set(cacheKey, items);
          setLookupNote({ tone: "info", message: `Showing latest for ${friendNameForId(targetId)}` });
        } else {
          setLookupVessel(null);
          setLookupNote({ tone: "error", message: "No location data yet." });
          setMapCenter(undefined);
        }
      };
      if (cached) {
        apply(cached);
        return;
      }
      try {
        const res = await memberService.getUserLocation(targetId, targetDevice || undefined);
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const vesselsFromLookup = buildLookupVessels(
          rows.map((row: any) => ({
            ...row,
            user_id: row.user_id || row.userId || targetId,
            friend_display_name: friendNameForId(row.user_id || row.userId || targetId),
          }))
        );
        apply(vesselsFromLookup);
      } catch {
        setLookupNote({ tone: "error", message: "Unable to load that user right now." });
      }
    },
    [friendNameForId, memberService, viewDeviceId, viewUserId]
  );

  const handleRecenter = useCallback(() => {
    enableAutoFollow();

    const centerOnKnown = () => {
      if (guardian.lastFix?.longitude != null && guardian.lastFix?.latitude != null) {
        setMapCenter([guardian.lastFix.longitude, guardian.lastFix.latitude], { zoom: 14, force: true });
        return true;
      }
      const latest = guardian.devices?.[0];
      if (latest?.longitude != null && latest?.latitude != null) {
        setMapCenter([latest.longitude, latest.latitude], { zoom: 14, force: true });
        return true;
      }
      if (guestLngLat?.[0] != null && guestLngLat?.[1] != null) {
        setMapCenter([guestLngLat[0], guestLngLat[1]], { zoom: 14, force: true });
        return true;
      }
      const candidate = filteredVessels.find((v) => Array.isArray(v.lngLat) && v.lngLat.length === 2);
      if (candidate?.lngLat) {
        setMapCenter(candidate.lngLat as [number, number], { zoom: 14, force: true });
        return true;
      }
      return false;
    };

    // Primary behavior: recenter to the latest known vessel fix.
    if (centerOnKnown()) return;

    // Fallback: ask for geolocation only if we have no vessel coordinates.
    const hasGeoApi = typeof navigator !== "undefined" && Boolean(navigator.geolocation);
    if (!hasGeoApi) return;

    requestLocation({
      forceModal: true,
      // Allow browser prompt if needed.
      skipBrowserPrompt: false,
      onGrant: () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setMapCenter([pos.coords.longitude, pos.coords.latitude], { zoom: 14, force: true });
          },
          () => {
            centerOnKnown();
          },
          { enableHighAccuracy: true, maximumAge: guardian.uploadIntervalSec * 1000, timeout: 15000 }
        );
      },
      onDeny: () => {
        centerOnKnown();
      },
    });
  }, [enableAutoFollow, filteredVessels, guardian.devices, guardian.lastFix, guardian.uploadIntervalSec, guestLngLat, requestLocation, setMapCenter]);

  const headingDirection = useMemo(() => {
    if (!guardian.timeline?.length) return undefined;
    const points = [...guardian.timeline].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    if (points.length < 2) return undefined;
    const prev = points[points.length - 2];
    const last = points[points.length - 1];
    if (!prev || !last) return undefined;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const y = Math.sin(toRad(last.longitude - prev.longitude)) * Math.cos(toRad(last.latitude));
    const x =
      Math.cos(toRad(prev.latitude)) * Math.sin(toRad(last.latitude)) -
      Math.sin(toRad(prev.latitude)) * Math.cos(toRad(last.latitude)) * Math.cos(toRad(last.longitude - prev.longitude));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }, [guardian.timeline]);

  const canRecenter = useMemo(() => {
    const hasKnown =
      (guardian.lastFix?.longitude != null && guardian.lastFix?.latitude != null) ||
      Boolean(guardian.devices?.length) ||
      Boolean(filteredVessels?.length) ||
      Boolean(guestLngLat?.length);
    const hasGeoApi = typeof navigator !== "undefined" && Boolean(navigator.geolocation);
    return hasKnown || hasGeoApi;
  }, [filteredVessels?.length, guardian.devices?.length, guardian.lastFix, guestLngLat]);
  return {
    viewUserId,
    setViewUserId,
    viewDeviceId,
    setViewDeviceId,
    lookupVessel,
    lookupNote,
    mapCenter,
    setMapCenter,
    setDeviceTypeFilter,
    setVesselScope,
    setVesselSearch,
    vesselSearch,
    handleLookup,
    handleRecenter,
    liveVessels,
    timelineVessels,
    vessels,
    filteredVessels,
    trackingVessels,
    deviceTypeOptions,
    statusLabel,
    headingDirection,
    canRecenter,
    adminVessels,
    adminPage,
    adminPageSize,
    adminTotal,
    setAdminPage,
    setAdminPageSize,
    vesselScope,
    fleetLoading,
    deviceTypeFilter,
    viewMode,
    setViewMode: (mode: GuardianViewMode) => onUpdateSetting({ viewMode: mode }),
    shareDeviceId,
    setShareDeviceId: setShareDeviceId || (() => undefined),
    setLookupNote,
    mapZoom,
    setMapZoom,
    fallbackVessels,
    autoFollow,
    enableAutoFollow,
    disableAutoFollow,
  };
};

export default useGuardianDataState;
