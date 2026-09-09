import React from 'react';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';
import { useMediaControl } from '../hooks/useMediaControl';
import { useLocalCams } from '../hooks/useLocalCams';
import { useAutoKindSwitch } from '../hooks/useAutoKindSwitch';
import CanopyOverlayMediaControlList from '../views/CanopyOverlayMediaControlList/CanopyOverlayMediaControlList';
import styles from "./CanopyOverlayMediaControls.scss"
type Props = {
  overlay: CanonOverlay;
  eventId?: string | number;
  showingAdvancedFields?: boolean;
  onChange: (e: any) => void;
};

const CanopyOverlayMediaControls: React.FC<Props> = ({ overlay, eventId, showingAdvancedFields, onChange }) => {
  const { liveMuted, livePlaying, togglePlay, toggleMute, restart } = useMediaControl({ overlay, eventId });
  const { localCams, camsLoading, selectedCam, handleCamPick, addAllCams } = useLocalCams({ overlay, onChange });
  useAutoKindSwitch(overlay, onChange);

  return (
    <>
      <style jsx>{styles}</style>
      {/* Real-time transport controls */}
      <div className="form__hint">Real‑time Controls (do not require Push Live)</div>
      <UiButtonGroup
        variant="bundle"
        btns={[
          {
            label: livePlaying ? 'Pause' : 'Play',
            variant: livePlaying ? 'ghost' : 'inherit',
            traits: { beforeIcon: livePlaying ? 'fa-pause' : 'fa-play' },
            onClick: togglePlay,
          },
          {
            label: 'Restart',
            traits: { beforeIcon: 'fa-rotate-left' },
            onClick: restart,
          },
        ]}
      />

      <CanopyOverlayMediaControlList
        overlay={overlay}
        showingAdvancedFields={showingAdvancedFields}
        onChange={onChange}
        localCams={localCams}
        camsLoading={camsLoading}
        selectedCam={selectedCam}
        onCamPick={handleCamPick}
        onAddAllCams={addAllCams}
      />
    </>
  );
};

export default CanopyOverlayMediaControls;
