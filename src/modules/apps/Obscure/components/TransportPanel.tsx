import React from "react";
import Obscurestyles from "../controller/Obscure.scss";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";

export type TransportMode = "start" | "stop";

type TransportPanelProps = {
  streamingActive: boolean;
  recordingActive: boolean;
  streamBusy: boolean;
  recordBusy: boolean;
  disabled: boolean;
  onStreamToggle: (mode: TransportMode) => void;
  onRecordToggle: (mode: TransportMode) => void;
};

const TransportPanel: React.FC<TransportPanelProps> = ({
  streamingActive,
  recordingActive,
  streamBusy,
  recordBusy,
  disabled,
  onStreamToggle,
  onRecordToggle,
}) => (
  <>
    <style jsx>{Obscurestyles}</style>
    <article className="obscure__panel">
      <header className="obscure__panel-head">
        <div>
          <h2>Transport</h2>
          <p>One-tap stream and recording controls.</p>
        </div>
      </header>
      <div className="obscure__action-grid">
        <div className="obscure__action">
          <span className="obscure__action-label">Streaming</span>
          <div className="obscure__action-controls">
            <UiButton
              variant={streamingActive ? "ghost" : undefined}
              onClick={() => onStreamToggle(streamingActive ? "stop" : "start")}
              aria-busy={streamBusy}
              disabled={disabled}
            >
              {streamingActive ? "Stop streaming" : "Go live"}
            </UiButton>
          </div>
        </div>
        <div className="obscure__action">
          <span className="obscure__action-label">Recording</span>
          <div className="obscure__action-controls">
            <UiButton
              variant={recordingActive ? "ghost" : undefined}
              onClick={() => onRecordToggle(recordingActive ? "stop" : "start")}
              aria-busy={recordBusy}
              disabled={disabled}
            >
              {recordingActive ? "Stop recording" : "Start recording"}
            </UiButton>
          </div>
        </div>
      </div>
    </article>
  </>
);

export default TransportPanel;
