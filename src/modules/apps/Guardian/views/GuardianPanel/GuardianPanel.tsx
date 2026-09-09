import React from "react";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import styles from "./GuardianPanel.scss";
import layoutStyles from "../../controller/Guardian.scss";
import LiveTrackingGuardianPanel from "./LiveTrackingGuardianPanel";
import UserTimelinePanel from "./UserTimelinePanel";
import UnauthenticatedGuardianPanel from "./UnauthenticatedGuardianPanel";
import { GuardianPanelProps, Props } from "./types";

const GuardianPanelContent: React.FC<GuardianPanelProps> = (props) => {
  if (!props.isAuthenticated) {
    return <UnauthenticatedGuardianPanel {...props} />;
  }
  if (props.viewMode === "timeline") {
    return <UserTimelinePanel {...props} />;
  }
  return <LiveTrackingGuardianPanel {...props} />;
};

const GuardianPanel: React.FC<GuardianPanelProps> = (props) => {
  const { panelCollapsed, onResizeHandlePointerDown, onPanelHandleClick, desktopMode, panelWidth } = props;
  const content = <GuardianPanelContent {...props} />;
  const showHandle = desktopMode !== false && typeof onResizeHandlePointerDown === "function";
  const sliderLeft = Math.max(((panelWidth ?? 28) - 8), 0);
  const sliderStyle =
    showHandle && panelCollapsed
      ? { right: "-6px", left: "auto" }
      : showHandle
        ? { left: `${sliderLeft}px`, right: "auto" }
        : undefined;

  const handleSliderPointerDown = (event: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if (typeof event.preventDefault === "function") event.preventDefault();
    onResizeHandlePointerDown?.(event as any);
  };

  return (
    <>
      <style jsx>{layoutStyles}</style>
      <style jsx>{styles}</style>
      {showHandle ? (
        <div
          className={`guardian__panel--slider ${panelCollapsed ? "guardian__panel--slider--peek" : ""}`}
          onPointerDown={handleSliderPointerDown}
          onMouseDown={handleSliderPointerDown as any}
          onTouchStart={handleSliderPointerDown as any}
          style={sliderStyle}
          role="separator"
          aria-label="Resize Guardian panel"
          aria-orientation="vertical"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onPanelHandleClick?.();
            }
          }}
        >
          <div
            className="guardian__panel--slider--icon"
            onPointerDown={handleSliderPointerDown}
            role="presentation"
          >
            <UiIcon
              icon="fa-bars"
              alt="Drag to resize Guardian panel"
            />
          </div>
        </div>
      ) : null}
      {content}
    </>
  );
};

export default GuardianPanel;
export type { GuardianPanelProps, Props };
