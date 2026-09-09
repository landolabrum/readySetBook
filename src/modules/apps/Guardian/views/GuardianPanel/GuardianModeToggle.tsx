import React from "react";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import styles from "./GuardianPanel.scss";
import { GuardianViewMode } from "../../hooks/useGuardian";

type Props = {
  viewMode: GuardianViewMode;
  onViewModeChange: (mode: GuardianViewMode) => void;
  uploadIntervalSec: number;
  onUploadIntervalChange: (sec: number) => void;
  timelineLoading: boolean;
  onRefreshTimeline: () => void;
};

const GuardianModeToggle: React.FC<Props> = ({
  viewMode,
  onViewModeChange,
  uploadIntervalSec,
  timelineLoading,
  onRefreshTimeline,
}) => {
  const nextMode: GuardianViewMode = viewMode === "live" ? "timeline" : "live";

  return (
    <>
      <style jsx>{styles}</style>
      <section className="guardian__mode-toggle">
        <UiButton
          variant={viewMode === "live" ? "primary" : "flat"}
          onClick={() => onViewModeChange("live")}
        >
          Live tracking
        </UiButton>
        <UiButton
          variant={viewMode === "timeline" ? "primary" : "flat"}
          onClick={() => onViewModeChange("timeline")}
        >
          Timeline
        </UiButton>
        <UiButton variant="flat" onClick={() => onViewModeChange(nextMode)}>
          {viewMode === "live" ? "Go to timeline" : "Back to live tracking"}
        </UiButton>

        {viewMode === "timeline" ? (
          <UiButton variant="flat" onClick={onRefreshTimeline} disabled={timelineLoading}>
            {timelineLoading ? "Refreshing…" : "Refresh timeline"}
          </UiButton>
        ) : null}
        <div className="guardian__mode-select">
          <span className="guardian__mode-fixed">{`Upload every ${uploadIntervalSec}s (fixed)`}</span>
        </div>
      </section>
    </>
  );
};

export default GuardianModeToggle;
