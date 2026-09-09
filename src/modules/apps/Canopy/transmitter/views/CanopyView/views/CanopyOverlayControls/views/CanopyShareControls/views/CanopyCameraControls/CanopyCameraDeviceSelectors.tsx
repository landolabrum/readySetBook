import React from "react";

type Props = {
  videoInputs: MediaDeviceInfo[];
  audioInputs: MediaDeviceInfo[];
  selectedVideoId?: string;
  selectedAudioId?: string;
  onVideoChange: (id?: string) => void;
  onAudioChange: (id?: string) => void;
};

const CanopyCameraDeviceSelectors: React.FC<Props> = ({
  videoInputs,
  audioInputs,
  selectedVideoId,
  selectedAudioId,
  onVideoChange,
  onAudioChange,
}) => {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
      <label style={{ fontSize: 12 }}>
        Camera
        <select style={{ marginLeft: 6, minWidth: 180 }} value={selectedVideoId ?? ""} onChange={(e) => onVideoChange(e.target.value || undefined)}>
          {videoInputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>)}
          {!videoInputs.length && <option value="">No cameras detected</option>}
        </select>
      </label>
      <label style={{ fontSize: 12 }}>
        Microphone
        <select style={{ marginLeft: 6, minWidth: 180 }} value={selectedAudioId ?? ""} onChange={(e) => onAudioChange(e.target.value || undefined)}>
          {audioInputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}
          {!audioInputs.length && <option value="">No mics detected</option>}
        </select>
      </label>
    </div>
  );
};

export default CanopyCameraDeviceSelectors;
