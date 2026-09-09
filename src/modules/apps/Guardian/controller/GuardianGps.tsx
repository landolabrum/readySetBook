import React, { useCallback, useMemo } from "react";
import GuardianView from "../views/GuardianView/GuardianView";
import { GuardianProvider, useGuardian } from "../context/GuardianContext";
import { useUser } from "~/src/core/authentication/hooks/useUser";
import useLocationPermissions from "@webstack/hooks/user/useLocationPermissions";
import useGuardianDataState from "./hooks/useGuardianDataState";
import { getService } from "@webstack/common";
import IMemberService from "~/src/core/services/MemberService/IMemberService";
import { GuardianViewMode } from "../hooks/useGuardian";
import styles from "./GuardianGps.scss";

const resolveClearanceLevel = (user: any): number => {
  const candidates = [
    user?.metadata?.user?.clearance,
    user?.metadata?.clearance,
    user?.clearance,
    (user as any)?.user?.clearance,
    (user as any)?.claims?.metadata?.user?.clearance,
  ];
  for (const value of candidates) {
    if (value == null) continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return 0;
};

const GuardianGpsContent: React.FC = () => {
  const guardian = useGuardian();
  const user = useUser();
  const clearanceLevel = resolveClearanceLevel(user);
  const { requestLocation, lngLat } = useLocationPermissions();
  const memberService = useMemo(() => getService<IMemberService>("IMemberService"), []);
  const updateSetting = useCallback((_: Partial<{ viewMode: GuardianViewMode }>) => undefined, []);

  const data = useGuardianDataState({
    guardian,
    user,
    memberService,
    viewMode: "live",
    onUpdateSetting: updateSetting,
    initialVesselScope: clearanceLevel >= 12 ? "all" : "mine",
    initialDeviceTypeFilter: "",
    friendVessels: [],
    shareDeviceId: null,
    friendNameForId: () => "",
    requestLocation,
    guestLngLat: lngLat,
  });

  const mapVessels = data.filteredVessels ?? data.vessels ?? [];

  const handleStartTracking = useCallback(() => {
    data.enableAutoFollow();
    if (guardian.lastFix?.longitude != null && guardian.lastFix?.latitude != null) {
      data.setMapCenter([guardian.lastFix.longitude, guardian.lastFix.latitude], { zoom: 14 });
    }
    guardian.startTracking(guardian.deviceInfo);
  }, [data.enableAutoFollow, data.setMapCenter, guardian.deviceInfo, guardian.lastFix, guardian.startTracking]);

  const handleStopTracking = useCallback(() => {
    guardian.stopTracking();
  }, [guardian]);

  return (
    <div className="guardian-gps">
      <style jsx>{styles}</style>
      <GuardianView
        mapCenter={data.mapCenter}
        fallbackVessels={data.fallbackVessels}
        mapZoom={data.mapZoom}
        vessels={mapVessels}
        lastFix={guardian.lastFix}
        mode={data.viewMode}
        timelineCount={guardian.timeline?.length || 0}
        timelineWindowLabel="Last 24h"
        uploadIntervalSec={guardian.uploadIntervalSec}
        devices={guardian.devices}
        deviceLabel={guardian.deviceLabel}
        deviceType={guardian.deviceType}
        deviceId={guardian.deviceId}
        mapOrientation="north"
        headingDirection={data.headingDirection}
        tracking={guardian.tracking}
        onStartTracking={handleStartTracking}
        onStopTracking={handleStopTracking}
        onUserMapInteract={data.disableAutoFollow}
        onRecenter={data.handleRecenter}
        canRecenter={data.canRecenter}
        autoFollow={data.autoFollow}
        minimal
        fullscreen
      />
    </div>
  );
};

const GuardianGps: React.FC = () => (
  <GuardianProvider>
    <GuardianGpsContent />
  </GuardianProvider>
);

export default GuardianGps;
