import React from 'react';
import styles from './OverlayHud.scss';
import HiddenBuildId from '@webstack/lib/project/BuildInfo/useBuildInfo';

interface OverlayHudProps {
  gpsData?: {
    lat?: number;
    lon?: number;
    timestamp?: string;
    [key: string]: any;
  };
}

const OverlayHud: React.FC<OverlayHudProps> = ({ gpsData }) => {
  return (
    <>
      <style jsx>{styles}</style>
      <fieldset className="overlay-hud">
        <legend>GPS</legend>
        {gpsData ? (
          <>
            <div className="-overlay-hud__title">HUD DATA</div>
            <div className="-overlay-hud__coords">
              <span>Lat:</span> {gpsData.lat?.toFixed(6)} <br />
              <span>Lon:</span> {gpsData.lon?.toFixed(6)} <br />
              <span>Time:</span> {gpsData.timestamp}
            </div>
          </>
        ) : (
          <div className="-overlay-hud__empty">No GPS Data</div>
        )}
      </fieldset>
<fieldset>
  <legend>
    Build
  </legend>
        <HiddenBuildId hide={false}/>
</fieldset>
    </>
  );
};

export default OverlayHud;
