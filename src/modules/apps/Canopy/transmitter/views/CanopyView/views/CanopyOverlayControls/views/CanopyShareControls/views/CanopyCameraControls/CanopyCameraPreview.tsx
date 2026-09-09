import React from "react";

type Props = {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isLive: boolean;
};

const CanopyCameraPreview: React.FC<Props> = ({ localVideoRef, isLive }) => {
  return (
    <div style={{
      background: "#0d0d1a", border: "1px solid #333", borderRadius: 4,
      padding: 8, marginBottom: 12, position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 8, left: 8,
        background: isLive ? "#22c55e" : "#f59e0b",
        color: "#000", fontSize: 10, fontWeight: 700, padding: "2px 6px",
        borderRadius: 2, zIndex: 1, textTransform: "uppercase",
      }}>
        {isLive ? "● LIVE" : "Publishing..."}
      </div>
      <video ref={localVideoRef} autoPlay playsInline muted style={{
        width: "100%", maxHeight: 200, borderRadius: 2, background: "#000", objectFit: "contain",
      }} />
    </div>
  );
};

export default CanopyCameraPreview;
