import React from "react";
import styles from "./CanopyPanel.scss";
import { EventRow } from "@Canopy/hooks/useCanopy";
import StreamPanel from "../views/StreamPanel/controller/StreamPanel";
import OverlayPanel from "../views/OverlayPanel/controller/OverlayPanel";
import AudioPanel from "../views/AudioPanel/controller/AudioPanel";

type CanopyPanelSimpleProps = {
  current: EventRow | null;
};

const CanopyPanelContent: React.FC<CanopyPanelSimpleProps> = ({ current }) => {

  return (
    <>
      <style jsx>{styles}</style>
      <div className="canopy-panel">
        <StreamPanel current={current} />
        <OverlayPanel current={current} />
        <AudioPanel current={current} />
      </div>
    </>
  );
};

const CanopyPanel = (props: any) => {
  return <CanopyPanelContent {...props} />;
};
export default CanopyPanel;
