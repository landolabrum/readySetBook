import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import styles from "./Guardian.scss";
import GuardianPanel from "../views/GuardianPanel/GuardianPanel";
import GuardianView from "../views/GuardianView/GuardianView";
import { useGuardian } from "../context/GuardianContext";
import useWindow from "@webstack/hooks/window/useWindow";
import useLocationPermissions from "@webstack/hooks/user/useLocationPermissions";
import { useUser } from "~/src/core/authentication/hooks/useUser";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import { useNotification } from "@webstack/components/Notification/Notification";
import { getService } from "@webstack/common";
import IMemberService from "~/src/core/services/MemberService/IMemberService";
import useGuardianFriends from "./hooks/useGuardianFriends";
import useGuardianLayout from "./hooks/useGuardianLayout";
import useGuardianDataState from "./hooks/useGuardianDataState";
import useScreenWakeVideo from "./hooks/useScreenWakeVideo";
import { resolveLastSeen } from "../utils/vesselCommon";
import UiSliderLayout from "@webstack/layouts/UiSliderLayout/controller/UiSliderLayout";

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

const GuardianContainer: React.FC = () => {
  const { width } = useWindow();
  const { settings, updateSetting } = useGuardianLayout(width);
  const user = useUser();
  const currentUserId = user?.id || (user as any)?.memberId;
  const router = useRouter();
  const isGuardianRoute = useMemo(() => {
    const target = router.asPath || router.pathname || "";
    return target.includes("/guardian");
  }, [router.asPath, router.pathname]);
  useScreenWakeVideo({ enabled: isGuardianRoute });
  const memberService = useMemo(() => getService<IMemberService>("IMemberService"), []);
  const { requestLocation, permissionDenied, lngLat } = useLocationPermissions();
  const guardian = useGuardian();
  const friendsState = useGuardianFriends(currentUserId);
  const [hiddenVesselIds, setHiddenVesselIds] = useState<Set<string>>(new Set());
  const [trackingUiPending, setTrackingUiPending] = useState(false);
  const [, setNotification] = useNotification();
  const locationPromptedRef = useRef(false);

  // On load, try to resolve a location *only* if permission was already granted.
  // This prevents the default [0,0] (ocean) center without triggering a prompt/modal.
  useEffect(() => {
    if (locationPromptedRef.current) return;
    locationPromptedRef.current = true;
    void requestLocation({ skipPromptUI: true, skipBrowserPrompt: false });
  }, [requestLocation]);

  const data = useGuardianDataState({
    guardian,
    user,
    memberService,
    viewMode: settings.viewMode,
    onUpdateSetting: updateSetting,
    initialVesselScope: settings.vesselScope,
    initialDeviceTypeFilter: settings.deviceTypeFilter,
    friendVessels: friendsState.friendVessels,
    shareDeviceId: friendsState.shareDeviceId,
    setShareDeviceId: friendsState.setShareDeviceId,
    friendNameForId: friendsState.friendNameForId,
    requestLocation,
    guestLngLat: lngLat,
  });

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    const params = new URLSearchParams();
    const userId = data.viewUserId || currentUserId;
    if (userId) params.set("user", userId);
    if (friendsState.shareDeviceId) params.set("device", friendsState.shareDeviceId);
    const suffix = params.toString();
    return suffix ? `${base}/app/guardian?${suffix}` : `${base}/app/guardian`;
  }, [currentUserId, data.viewUserId, friendsState.shareDeviceId]);

  // Keep URL in sync without spamming history.replaceState
  const lastQueryRef = React.useRef<string>("");
  useEffect(() => {
    if (!router.isReady) return;
    const query: Record<string, string> = {};
    if (data.viewUserId) query.user = data.viewUserId;
    if (data.viewDeviceId) query.device = data.viewDeviceId;
    const search = new URLSearchParams(query).toString();
    if (search === lastQueryRef.current) return;
    lastQueryRef.current = search;
    router.replace(
      { pathname: "/app/guardian", query: search ? query : undefined },
      undefined,
      { shallow: true }
    );
  }, [data.viewDeviceId, data.viewUserId, router, router.isReady]);

  useEffect(() => {
    updateSetting({ vesselScope: data.vesselScope, deviceTypeFilter: data.deviceTypeFilter });
  }, [data.deviceTypeFilter, data.vesselScope, updateSetting]);

  const handleToggleTracking = useCallback(() => {
    if (guardian.tracking) {
      setTrackingUiPending(false);
      guardian.stopTracking();
      return;
    }
    if (!currentUserId) {
      setNotification({
        active: true,
        dismissable: true,
        list: [{ label: "Sign in required", message: "Log in to start live tracking on this device." }],
      });
      return;
    }
    const hasGeoApi = typeof navigator !== "undefined" && Boolean(navigator.geolocation);
    if (!hasGeoApi) {
      setNotification({
        active: true,
        dismissable: true,
        list: [{ label: "Unavailable", message: "Geolocation is not supported in this browser." }],
      });
      return;
    }

    setTrackingUiPending(true);
    let started = false;
    const start = () => {
      if (started || guardian.tracking) return;
      started = true;
      data.enableAutoFollow();
      if (guardian.lastFix?.longitude != null && guardian.lastFix?.latitude != null) {
        data.setMapCenter([guardian.lastFix.longitude, guardian.lastFix.latitude], { zoom: 14 });
      }
      guardian.startTracking(guardian.deviceInfo);
    };

    const queryPermission = async (): Promise<PermissionState | "unsupported" | "error"> => {
      try {
        if (typeof navigator === "undefined" || !navigator.permissions) return "unsupported";
        const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        return status.state;
      } catch {
        return "error";
      }
    };

    queryPermission()
      .then((permission) => {
        if (permission === "granted") {
          start();
          return;
        }
        return requestLocation({
          forceModal: true,
          skipBrowserPrompt: false,
          onGrant: () => {
            setTrackingUiPending(true);
            start();
          },
          onDeny: () => {
            guardian.stopTracking("error");
            setNotification({
              active: true,
              dismissable: true,
              list: [{ label: "Location blocked", message: "Enable location permissions to start tracking." }],
            });
          },
        }).then((state: string | undefined) => {
          if (state === "granted" || state === "prompt") {
            setTrackingUiPending(true);
            start();
            return;
          }
          guardian.stopTracking("error");
          setTrackingUiPending(false);
          setNotification({
            active: true,
            dismissable: true,
            list: [{ label: "Location needed", message: "We couldn’t start tracking without location access." }],
          });
        });
      })
      .catch(() => {
        setTrackingUiPending(false);
      });
  }, [
    currentUserId,
    data.enableAutoFollow,
    data.setMapCenter,
    guardian.deviceInfo,
    guardian.lastFix,
    guardian.startTracking,
    guardian.stopTracking,
    guardian.tracking,
    requestLocation,
    setNotification,
  ]);

  useEffect(() => {
    if (guardian.tracking) {
      setTrackingUiPending(false);
    }
    if (!guardian.tracking && !guardian.trackingResumePending) {
      setTrackingUiPending(false);
    }
  }, [guardian.trackingResumePending]);

  // Auto-resume tracking after reload when we have permission or can prompt
  useEffect(() => {
    if (!guardian.trackingResumePending || guardian.tracking || trackingUiPending) return;
    const run = async () => {
      try {
        const permission = await (async () => {
          try {
            if (typeof navigator === "undefined" || !navigator.permissions) return "unsupported" as const;
            const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
            return status.state as PermissionState;
          } catch {
            return "error" as const;
          }
        })();

        if (permission === "granted") {
          data.enableAutoFollow();
          if (guardian.lastFix?.longitude != null && guardian.lastFix?.latitude != null) {
            data.setMapCenter([guardian.lastFix.longitude, guardian.lastFix.latitude], { zoom: 14 });
          }
          guardian.startTracking(guardian.deviceInfo);
          return;
        }

        await requestLocation({
          forceModal: true,
          skipBrowserPrompt: false,
          onGrant: () => {
            data.enableAutoFollow();
            if (guardian.lastFix?.longitude != null && guardian.lastFix?.latitude != null) {
              data.setMapCenter([guardian.lastFix.longitude, guardian.lastFix.latitude], { zoom: 14 });
            }
            guardian.startTracking(guardian.deviceInfo);
          },
          onDeny: () => guardian.stopTracking("error"),
        });
      } catch {
        guardian.stopTracking("error");
      }
    };
    run();
  }, [
    data.enableAutoFollow,
    data.setMapCenter,
    guardian,
    guardian.deviceInfo,
    guardian.lastFix?.latitude,
    guardian.lastFix?.longitude,
    guardian.tracking,
    guardian.trackingResumePending,
    requestLocation,
    trackingUiPending,
  ]);

  const clearanceLevel = resolveClearanceLevel(user);
  const dedupedMapVessels = useMemo(() => {
    const byId = new Map<string, any>();
    data.vessels.forEach((v: IVessel) => {
      const meta = (v as IVessel & { meta?: any })?.meta || {};
      const key = v?.id != null ? String(v.id) : meta.deviceId || meta.deviceLabel || meta.userId;
      if (!key) return;
      byId.set(key, { ...v, id: key });
    });
    return Array.from(byId.values());
  }, [data.vessels]);

  const filteredVessels = useMemo(
    () => data.filteredVessels.filter((v: IVessel) => !hiddenVesselIds.has(String(v.id))),
    [data.filteredVessels, hiddenVesselIds]
  );
  const trackingVessels = useMemo(
    () => (data.trackingVessels || []).filter((v: IVessel) => !hiddenVesselIds.has(String(v.id))),
    [data.trackingVessels, hiddenVesselIds]
  );
  const trackingGridVessels = useMemo(() => {
    const base = data.adminVessels?.length ? data.adminVessels : data.trackingVessels || [];
    const seen = new Map<string, IVessel>();
    const resolveKey = (v: IVessel) => {
      const meta = (v as IVessel & { meta?: any })?.meta || {};
      return String(v.id ?? meta.deviceId ?? meta.deviceLabel ?? meta.userId ?? "");
    };
    const lasted = (v?: IVessel) => {
      if (!v) return 0;
      const meta = (v as IVessel & { meta?: any })?.meta || {};
      return resolveLastSeen(meta) ?? 0;
    };
    base.forEach((v) => {
      const key = resolveKey(v);
      if (!key || hiddenVesselIds.has(key)) return;
      const current = seen.get(key);
      if (!current || lasted(v) > lasted(current)) {
        seen.set(key, { ...v, id: key });
      }
    });
    return Array.from(seen.values()).sort((a, b) => lasted(b) - lasted(a));
  }, [data.adminVessels, data.trackingVessels, hiddenVesselIds]);
  const filteredMapVessels = useMemo(
    () => dedupedMapVessels.filter((v) => !hiddenVesselIds.has(String(v.id))),
    [dedupedMapVessels, hiddenVesselIds]
  );
  const trackingMapVessels = useMemo(() => {
    const byId = new Map<string, any>();
    trackingVessels.forEach((v: IVessel) => {
      const meta = (v as IVessel & { meta?: any })?.meta || {};
      const key = v?.id != null ? String(v.id) : meta.deviceId || meta.deviceLabel || meta.userId;
      if (!key) return;
      byId.set(key, { ...v, id: key });
    });
    return Array.from(byId.values());
  }, [trackingVessels]);
  const mapVessels = useMemo(() => {
    const shouldShowTracking = data.viewMode === "live" && clearanceLevel >= 12 && trackingMapVessels.length;
    if (shouldShowTracking) return trackingMapVessels;
    return filteredMapVessels;
  }, [clearanceLevel, data.viewMode, filteredMapVessels, trackingMapVessels]);
  const handleRemoveVessel = useCallback(
    async (vesselId: string) => {
      const allVessels = [...filteredMapVessels, ...filteredVessels, ...dedupedMapVessels];
      const rawId = String(vesselId ?? "").trim();

      const parseId = (value: string): { userId?: string; deviceId?: string } => {
        if (!value) return {};
        if (!value.includes(":")) return { deviceId: value };
        const [first, second] = value.split(":", 2);
        if (first === "device") return { deviceId: second };
        if (first === "user") return { userId: second };
        return { userId: first, deviceId: second };
      };

      const parsed = parseId(rawId);
      const candidateDeviceId = (parsed.deviceId || "").trim() || rawId;

      const vessel =
        allVessels.find((v) => String(v.id) === rawId) ||
        allVessels.find((v) => {
          const meta = (v as any)?.meta || {};
          const metaDeviceId = String(meta.deviceId || "").trim();
          const metaDeviceLabel = String(meta.deviceLabel || "").trim();
          const vid = String(v.id ?? "");
          return (
            (metaDeviceId && metaDeviceId === candidateDeviceId) ||
            (metaDeviceLabel && metaDeviceLabel === candidateDeviceId) ||
            (candidateDeviceId && (vid === `device:${candidateDeviceId}` || vid.endsWith(`:${candidateDeviceId}`)))
          );
        });

      const meta = (vessel as any)?.meta || {};
      const resolvedDeviceId = String(meta.deviceId || meta.deviceLabel || candidateDeviceId || "").trim();
      const resolvedUserId = String(meta.userId || parsed.userId || data.viewUserId || currentUserId || "").trim() || undefined;

      if (!resolvedDeviceId) {
        setNotification({
          active: true,
          dismissable: true,
          list: [{ label: "Remove device failed", message: "Missing device id for this vessel." }],
        });
        return;
      }

      try {
        const isAdmin = (clearanceLevel ?? 0) >= 12;
        const isOtherUser = Boolean(resolvedUserId && currentUserId && resolvedUserId !== currentUserId);
        if (isAdmin && isOtherUser && resolvedUserId) {
          await memberService.adminRemoveUserDevice(resolvedUserId, resolvedDeviceId, { purgeTimeline: true });
        } else {
          // User-scoped delete (backend resolves userId from token)
          await memberService.removeUserDevice(undefined, resolvedDeviceId, { purgeTimeline: true });
        }
        setHiddenVesselIds((prev) => {
          const next = new Set(prev);
          next.add(rawId);
          next.add(resolvedDeviceId);
          next.add(`device:${resolvedDeviceId}`);
          if (resolvedUserId) next.add(`${resolvedUserId}:${resolvedDeviceId}`);
          return next;
        });
        if (!resolvedUserId || resolvedUserId === currentUserId) {
          guardian.removeDevice?.(resolvedDeviceId);
          guardian.refreshTimeline({ force: true, userId: resolvedUserId }).catch(() => undefined);
        }
        setNotification({
          active: true,
          dismissable: true,
          list: [{ label: "Device removed", message: "Removed from manifest and backend history." }],
        });
      } catch (err: any) {
        const message = err?.message || "Unable to remove this device.";
        setNotification({
          active: true,
          dismissable: true,
          list: [{ label: "Remove device failed", message }],
        });
      }
    },
    [
      clearanceLevel,
      currentUserId,
      data.viewUserId,
      dedupedMapVessels,
      filteredMapVessels,
      filteredVessels,
      guardian,
      memberService,
      setNotification,
    ]
  );

  const handlePurgeAllTracking = useCallback(async () => {
    const isSuperAdmin = (clearanceLevel ?? 0) >= 15;
    if (!isSuperAdmin) {
      setNotification({
        active: true,
        dismissable: true,
        list: [{ label: "Not authorized", message: "Clearance 15 required to purge tracking." }],
      });
      return;
    }
    try {
      await memberService.adminPurgeGpsTracking();
      setHiddenVesselIds(new Set());
      data.setAdminPage?.(1);
      data.setViewUserId?.("");
      data.setViewDeviceId?.("");
      setNotification({
        active: true,
        dismissable: true,
        list: [{ label: "Tracking purged", message: "All GPS tracking rows were deleted." }],
      });
    } catch (err: any) {
      const message = err?.message || "Unable to purge tracking.";
      setNotification({
        active: true,
        dismissable: true,
        list: [{ label: "Purge failed", message }],
      });
    }
  }, [clearanceLevel, data, memberService, setNotification]);

  // If useLocation already resolved a position, center the map without re-opening the modal.
  useEffect(() => {
    if (!lngLat) return;
    data.setMapCenter?.(lngLat);
    data.setMapZoom?.(14);
  }, [data.setMapCenter, data.setMapZoom, lngLat]);

  // If user logs in with no fixes yet, keep the last guest center so the map is not blank.
  useEffect(() => {
    if (!currentUserId || data.mapCenter) return;
    if (lngLat) {
      data.setMapCenter?.(lngLat);
      data.setMapZoom?.(14);
    }
  }, [currentUserId, data.mapCenter, data.setMapCenter, data.setMapZoom, lngLat]);

  return (
    <>
      <style jsx>{styles}</style>
      <UiSliderLayout
        viewportWidth={width}
        storageKey="guardian:panelWidth"
        initialWidth={settings.panelWidth}
        onWidthPersist={(value) => updateSetting({ panelWidth: value })}
        className="guardian"
        panelClassName={(state) =>
          `guardian__panel ${state.isDesktop || state.showPanel ? "guardian__panel--show" : ""} ${state.isDesktop && state.panelHidden ? "guardian__panel--collapsed" : ""}`
        }
        contentClassName="guardian__view"
        handleAriaLabel="Resize Guardian panel"
        renderMobileToggle={(state) =>
          state.isDesktop ? null : (
            <button
              type="button"
              className={`guardian__trigger ${state.showPanel ? "guardian__trigger--show" : ""}`}
              onClick={state.togglePanel}
              aria-label="Toggle Guardian panel"
            >
              <UiIcon icon="fa-gear" alt="Toggle Guardian panel" />
            </button>
          )
        }
        renderPanel={(state) => (
          <GuardianPanel
            tracking={guardian.tracking || trackingUiPending}
            statusLabel={trackingUiPending ? "Requesting" : data.statusLabel}
            lastFix={guardian.lastFix}
            lastBackendSync={guardian.lastBackendSync}
            error={guardian.error}
            permissionDenied={permissionDenied}
            shareUrl={shareUrl}
            deviceInfo={guardian.deviceInfo}
            deviceId={guardian.deviceId}
            deviceLabel={guardian.deviceLabel}
            deviceType={guardian.deviceType}
            isAuthenticated={Boolean(currentUserId)}
            userId={currentUserId ?? null}
            userName={user?.name}
            viewUserId={data.viewUserId}
            viewDeviceId={data.viewDeviceId}
            viewFriendName={data.viewUserId ? friendsState.friendNameForId(data.viewUserId) : ""}
            friends={friendsState.friends}
            friendsLoading={friendsState.loading}
            friendDisplayNames={friendsState.friendNames}
            adminVessels={data.adminVessels}
            adminPage={data.adminPage}
            adminPageSize={data.adminPageSize}
            adminTotal={data.adminTotal}
            onAdminPageChange={data.setAdminPage}
            onAdminPageSizeChange={data.setAdminPageSize}
            devices={guardian.devices}
            onViewUserIdChange={data.setViewUserId}
            onLookupUser={data.handleLookup}
            onAddFriend={(id) => void friendsState.addFriend(id ?? data.viewUserId)}
            onSelectFriend={(id) => void data.handleLookup(id)}
            onRemoveFriend={(id) => void friendsState.removeFriend(id)}
            shareDeviceId={friendsState.shareDeviceId}
            onShareDeviceChange={(id) => {
              const next = (id ?? "").trim() || null;
              friendsState.setShareDeviceId(next);
              data.setViewDeviceId(next ?? "");
            }}
            onToggleTracking={handleToggleTracking}
            onRecenter={data.handleRecenter}
            canRecenter={data.canRecenter}
            viewMode={data.viewMode}
            onViewModeChange={data.setViewMode}
            timeline={guardian.timeline}
            timelineLoading={guardian.timelineLoading}
            onRefreshTimeline={() => guardian.refreshTimeline({ force: true })}
            uploadIntervalSec={guardian.uploadIntervalSec}
            onUploadIntervalChange={guardian.setUploadIntervalSec}
            staleFix={guardian.staleFix}
            lookupNote={data.lookupNote}
            vesselScope={data.vesselScope}
            onVesselScopeChange={data.setVesselScope}
            vesselSearch={data.vesselSearch}
            onVesselSearchChange={data.setVesselSearch}
            deviceTypeFilter={data.deviceTypeFilter}
            onDeviceTypeFilterChange={(val) => data.setDeviceTypeFilter((val ?? "").toLowerCase())}
            deviceTypeOptions={data.deviceTypeOptions}
            visibleVessels={mapVessels}
            visibleTableVessels={filteredVessels}
            trackingVessels={trackingVessels}
            trackingGridVessels={trackingGridVessels}
            onRemoveVessel={handleRemoveVessel}
            onPurgeAllTracking={handlePurgeAllTracking}
            clearanceLevel={clearanceLevel}
            mapOrientation={settings.mapOrientation}
            onMapOrientationChange={(orientation) => updateSetting({ mapOrientation: orientation })}
            headingAvailable={typeof data.headingDirection === "number"}
            trackingResumePending={guardian.trackingResumePending || trackingUiPending}
            panelCollapsed={state.panelHidden}
            desktopMode={state.isDesktop}
            panelWidth={state.visiblePanelWidth}
          />
        )}
        renderContent={(state) => (
          <>
            {state.isDesktop && state.panelHidden ? (
              <div
                className="guardian__panel-hidden-trigger"
                role="button"
                tabIndex={0}
                onClick={state.revealPanel}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    state.revealPanel();
                  }
                }}
              >
                ⚙
              </div>
            ) : null}
            <GuardianView
              mapCenter={data.mapCenter}
              fallbackVessels={data.fallbackVessels}
              mapZoom={data.mapZoom}
              vessels={mapVessels}
              lastFix={guardian.lastFix || undefined}
              mode={data.viewMode}
              timelineCount={guardian.timeline?.length || 0}
              timelineWindowLabel={guardian.timeline?.length ? "Last 24h" : "No history"}
              uploadIntervalSec={guardian.uploadIntervalSec}
              devices={guardian.devices}
              deviceLabel={guardian.deviceLabel}
              deviceType={guardian.deviceType}
              deviceId={guardian.deviceId}
              mapOrientation={settings.mapOrientation}
              headingDirection={data.headingDirection}
              tracking={guardian.tracking}
              onStartTracking={handleToggleTracking}
              onStopTracking={() => guardian.stopTracking()}
              onUserMapInteract={data.disableAutoFollow}
              onRecenter={data.handleRecenter}
              canRecenter={data.canRecenter}
              autoFollow={data.autoFollow}
            />
          </>
        )}
      />
    </>
  );
};

export default GuardianContainer;
