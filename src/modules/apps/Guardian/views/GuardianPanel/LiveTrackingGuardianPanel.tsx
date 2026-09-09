import React from "react";
import panelStyles from "./GuardianPanel.scss";
import layoutStyles from "../../controller/Guardian.scss";
import GuardianAdminFilters from "./GuardianAdminFilters";
import GuardianHeader from "./GuardianHeader";
import GuardianModeToggle from "./GuardianModeToggle";
import GuardianLookupForm from "./GuardianLookupForm";
import GuardianDeviceTable from "./GuardianDeviceTable";
import { formatAccuracy, formatTime } from "./panelUtils";
import { GuardianPanelProps } from "./types";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import GuardianTrackingGrid from "./GuardianTrackingGrid";

const LiveTrackingGuardianPanel: React.FC<GuardianPanelProps> = (props) => {
  const {
    tracking,
    statusLabel,
    lastFix,
    lastBackendSync,
    error,
    permissionDenied,
    deviceInfo,
    deviceId,
    deviceLabel,
    deviceType,
    shareUrl,
    viewMode,
    onViewModeChange,
    uploadIntervalSec,
    onUploadIntervalChange,
    timelineLoading,
    onRefreshTimeline,
    viewUserId,
    friends,
    onViewUserIdChange,
    onLookupUser,
    onAddFriend,
    onSelectFriend,
    onRemoveFriend,
    shareDeviceId,
    onShareDeviceChange,
    friendsLoading,
    lookupNote,
    viewFriendName,
    friendDisplayNames,
    adminVessels,
    timeline,
    devices,
    visibleVessels,
    clearanceLevel,
    vesselScope,
    onVesselScopeChange,
    vesselSearch,
    onVesselSearchChange,
    deviceTypeFilter,
    onDeviceTypeFilterChange,
    deviceTypeOptions,
    visibleTableVessels,
    trackingVessels,
    trackingGridVessels,
    adminPage,
    adminPageSize,
    adminTotal,
    onAdminPageChange,
    onAdminPageSizeChange,
    mapOrientation = "north",
    onMapOrientationChange,
    headingAvailable = false,
    staleFix,
    onToggleTracking,
    onRecenter,
    canRecenter,
    trackingResumePending,
  } = props;

  const canRemoveDevices = (clearanceLevel ?? 0) >= 12;
  const speedText =
    typeof lastFix?.speedMph === "number" && Number.isFinite(lastFix.speedMph)
      ? `${lastFix.speedMph.toFixed(1)} mph`
      : "—";
  const primaryDeviceLabel = deviceLabel || deviceId || "This device";
  const deviceTypeText = deviceType || deviceInfo?.deviceType || "—";
  const displayTs = lastFix?.displayTimestamp ?? lastFix?.timestamp ?? lastBackendSync;

  const statusRows = [
    { label: "Status", value: statusLabel },
    { label: "Last update", value: formatTime(displayTs) },
    { label: "Accuracy", value: formatAccuracy(lastFix?.accuracy) },
    { label: "Backend sync", value: formatTime(lastBackendSync) },
    { label: "Device", value: primaryDeviceLabel },
    { label: "Device type", value: deviceTypeText },
    { label: "Speed", value: speedText },
  ];

  const kvRows = [
    { label: "Upload rate", value: `Every ${uploadIntervalSec}s` },
    { label: "Devices online", value: devices?.length ?? 0 },
    { label: "Timeline points (last 24h)", value: timeline?.length ?? 0 },
    {
      label: "Last backend sync",
      value: formatTime(lastBackendSync),
    },
    {
      label: "Latest latitude",
      value: lastFix?.latitude != null ? lastFix.latitude.toFixed(4) : "—",
    },
    {
      label: "Latest longitude",
      value: lastFix?.longitude != null ? lastFix.longitude.toFixed(4) : "—",
    },
  ];
  const mergedTable = [...(props.adminVessels || []), ...(visibleTableVessels || []), ...(visibleVessels || [])];
  const seen = new Set<string>();
  let tableVessels = mergedTable.filter((v) => {
    const key = String(v.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }) as IVessel[];

  if (!tableVessels.length) {
    const sourceFix =
      devices?.[0] ||
      lastFix ||
      (Array.isArray(timeline) && timeline.length ? timeline[timeline.length - 1] : undefined);
    if (sourceFix) {
      tableVessels = [
        {
          id: sourceFix.deviceId || sourceFix.deviceLabel || "primary-device",
          name: sourceFix.deviceLabel || sourceFix.deviceId || "This device",
          lngLat:
            sourceFix.longitude != null && sourceFix.latitude != null
              ? [sourceFix.longitude, sourceFix.latitude]
              : undefined,
          meta: {
            userId: sourceFix.userId,
            deviceId: sourceFix.deviceId,
            deviceLabel: sourceFix.deviceLabel,
            deviceType: sourceFix.deviceType || sourceFix.deviceInfo?.deviceType,
            lastSeen: sourceFix.timestamp ?? sourceFix.displayTimestamp,
            latitude: sourceFix.latitude,
            longitude: sourceFix.longitude,
          },
        } as IVessel,
      ];
    }
  }

  return (
    <>
      <style jsx>{layoutStyles}</style>
      <style jsx>{panelStyles}</style>
      <section className="guardian__panel--content">
        <GuardianHeader
          lastFix={lastFix}
          tracking={tracking}
          trackingResumePending={trackingResumePending}
          onToggleTracking={onToggleTracking}
          onRecenter={onRecenter}
          canRecenter={canRecenter}
          deviceInfo={deviceInfo}
          deviceId={deviceId}
          deviceLabel={deviceLabel}
          deviceType={deviceType}
          shareUrl={shareUrl}
          shareDeviceId={shareDeviceId}
          onShareDeviceChange={onShareDeviceChange}
          devices={devices}
          visibleVessels={visibleVessels}
          clearanceLevel={clearanceLevel}
        />

        <GuardianAdminFilters
          clearanceLevel={clearanceLevel}
          vesselScope={vesselScope}
          onVesselScopeChange={onVesselScopeChange}
          vesselSearch={vesselSearch}
          onVesselSearchChange={onVesselSearchChange}
          deviceTypeFilter={deviceTypeFilter}
          onDeviceTypeFilterChange={onDeviceTypeFilterChange}
          deviceTypeOptions={deviceTypeOptions}
        />

        <div className="guardian__orientation-controls">
          <span className="guardian__orientation-title">Map orientation</span>
          <div className="guardian__orientation-buttons">
            <button
              type="button"
              className={`guardian__orientation-btn ${mapOrientation === "north" ? "guardian__orientation-btn--active" : ""
                }`}
              onClick={() => onMapOrientationChange?.("north")}
            >
              North up
            </button>
            <button
              type="button"
              className={`guardian__orientation-btn ${mapOrientation === "heading" ? "guardian__orientation-btn--active" : ""
                }`}
              onClick={() => onMapOrientationChange?.("heading")}
              disabled={!headingAvailable}
            >
              Follow heading
            </button>
          </div>
        </div>

        {canRemoveDevices ? (
          <GuardianTrackingGrid
            vessels={(trackingGridVessels && trackingGridVessels.length ? trackingGridVessels : trackingVessels) as IVessel[]}
            clearanceLevel={clearanceLevel}
            canRemoveDevices={canRemoveDevices}
            onRemoveVessel={props.onRemoveVessel}
            onPurgeAllTracking={props.onPurgeAllTracking}
          />
        ) : null}

        <GuardianDeviceTable
          vessels={tableVessels}
          deviceFixes={devices}
          onRemove={props.onRemoveVessel}
          canRemoveDevices={canRemoveDevices}
          page={adminPage}
          pageSize={adminPageSize}
          total={adminTotal}
          onPageChange={onAdminPageChange}
          onPageSizeChange={onAdminPageSizeChange}
        />

        <GuardianModeToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          uploadIntervalSec={uploadIntervalSec}
          onUploadIntervalChange={onUploadIntervalChange}
          timelineLoading={timelineLoading}
          onRefreshTimeline={onRefreshTimeline}
        />

        <section className="guardian__section guardian__section--overview">
          <div className="guardian__section-heading">
            <h2>Tracking overview</h2>
            <p>Designed for the Guardian experience team: mission-critical status for every tracked device.</p>
          </div>
          <div className="guardian__status-grid">
            {statusRows.map((row) => (
              <div key={`status-${row.label}`}>
                <label>{row.label}</label>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className="guardian__insights-grid">
            {kvRows.map((row, idx) => (
              <div key={`kv-${idx}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="guardian__section guardian__section--lookup">
          <GuardianLookupForm
            label="Monitor another user"
            description="Switch to a friend or teammate without leaving your own session."
            viewUserId={viewUserId}
            friends={friends}
            loading={friendsLoading}
            viewFriendName={viewFriendName}
            friendDisplayNames={friendDisplayNames}
            onViewUserIdChange={onViewUserIdChange}
            onLookupUser={onLookupUser}
            onAddFriend={onAddFriend}
            onSelectFriend={onSelectFriend}
            onRemoveFriend={onRemoveFriend}
            lookupNote={lookupNote}
          />
        </section>

        {error && <div className="guardian__error">{error}</div>}
        {permissionDenied && (
          <div className="guardian__error">
            Location permission denied. Click “Know Your Location” to retry.
          </div>
        )}
        {staleFix && lastFix?.timestamp && (
          <div className="guardian__hint">
            Latest fix is stale (last at {formatTime(lastFix.timestamp)}). Make sure tracking is
            active on this device.
          </div>
        )}
        {!!devices?.length && (
          <div className="guardian__devices">
            <div className="guardian__timeline-header">
              <h3>Devices</h3>
              <span>{devices.length} active</span>
            </div>
            <ul>
              {[...devices]
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((dev, idx) => (
                  <li key={`dev-${dev.deviceId || idx}`}>
                    <div>
                      <strong>{dev.deviceLabel || dev.deviceId || `Device ${idx + 1}`}</strong>
                      <div className="guardian__device-meta">
                        {dev.deviceType || dev.deviceInfo?.deviceType || "—"}
                        {dev.deviceId ? ` · ${dev.deviceId}` : ""}
                      </div>
                      <div className="guardian__device-coords">
                        {dev.latitude.toFixed(4)}, {dev.longitude.toFixed(4)}
                      </div>
                    </div>
                    <div className="guardian__device-meta">
                      <span>{formatTime(dev.timestamp)}</span>
                      <span>± {formatAccuracy(dev.accuracy)}</span>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
};

export default LiveTrackingGuardianPanel;
