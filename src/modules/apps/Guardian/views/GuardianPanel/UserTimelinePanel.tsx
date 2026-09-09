
import React from "react";
import panelStyles from "./GuardianPanel.scss";
import layoutStyles from "../../controller/Guardian.scss";
import GuardianHeader from "./GuardianHeader";
import GuardianModeToggle from "./GuardianModeToggle";
import GuardianLookupForm from "./GuardianLookupForm";
import GuardianDeviceTable from "./GuardianDeviceTable";
import { formatAccuracy, formatTime } from "./panelUtils";
import { GuardianPanelProps } from "./types";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";

const UserTimelinePanel: React.FC<GuardianPanelProps> = (props) => {
  const {
    tracking,
    lastFix,
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
    viewFriendName,
    friendDisplayNames,
    adminVessels,
    adminPage,
    adminPageSize,
    adminTotal,
    onAdminPageChange,
    onAdminPageSizeChange,
    shareDeviceId,
    onShareDeviceChange,
    friendsLoading,
    lookupNote,
    timeline,
    devices,
    visibleVessels,
    visibleTableVessels,
    error,
    permissionDenied,
    staleFix,
    onToggleTracking,
    onRecenter,
    canRecenter,
  } = props;
  const displayTs = lastFix?.displayTimestamp ?? lastFix?.timestamp;
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
      <section className="guardian__panel">
        <GuardianHeader
          heading="Review your last 24 hours"
          subtitle="Scrub through your recent fixes, compare devices, and refresh the history window."
          lastFix={lastFix}
          tracking={tracking}
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
        />

        <GuardianModeToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          uploadIntervalSec={uploadIntervalSec}
          onUploadIntervalChange={onUploadIntervalChange}
          timelineLoading={timelineLoading}
          onRefreshTimeline={onRefreshTimeline}
        />

        <GuardianDeviceTable
          vessels={tableVessels}
          deviceFixes={devices}
          page={adminPage}
          pageSize={adminPageSize}
          total={adminTotal}
          onPageChange={onAdminPageChange}
          onPageSizeChange={onAdminPageSizeChange}
        />

        <GuardianLookupForm
          label="Jump to another timeline"
          description="Swap to a teammate’s feed to compare routes or verify their last check-in."
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

        <div className="guardian__timeline">
          <div className="guardian__timeline-header">
            <h3>Timeline</h3>
            <span>{timeline?.length ? `${timeline.length} pts` : "No data yet"}</span>
          </div>
          {timelineLoading && <div className="guardian__hint">Loading timeline…</div>}
          {!timelineLoading && (!timeline || !timeline.length) && (
            <div className="guardian__hint">
              No timeline data yet. Start tracking to populate your history.
            </div>
          )}
          {!timelineLoading && timeline?.length ? (
            <ul className="guardian__timeline-list">
              {timeline
                .slice(-10)
                .reverse()
                .map((point, idx) => (
                  <li key={`tl-${idx}`}>
                    <div>
                      <strong>{formatTime(point.timestamp)}</strong>
                      <div className="guardian__timeline-device">
                        <span>{point.deviceLabel || point.deviceId || "Device"}</span>
                        {point.deviceType ? <span>{point.deviceType}</span> : null}
                      </div>
                      <div>
                        {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                      </div>
                    </div>
                    <div className="guardian__timeline-meta">
                      <span>± {formatAccuracy(point.accuracy)}</span>
                      <span>
                        {typeof point.speedMph === "number" && Number.isFinite(point.speedMph)
                          ? `${point.speedMph.toFixed(1)} mph`
                          : "—"}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>

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

        {permissionDenied && (
          <div className="guardian__error">
            Location permission denied. Click “Know Your Location” to retry.
          </div>
        )}
        {staleFix && displayTs && (
          <div className="guardian__hint">
            Latest fix is stale (last at {formatTime(displayTs)}). Make sure tracking is
            active on this device.
          </div>
        )}
        {error && <div className="guardian__error">{error}</div>}
      </section>
    </>
  );
};

export default UserTimelinePanel;
