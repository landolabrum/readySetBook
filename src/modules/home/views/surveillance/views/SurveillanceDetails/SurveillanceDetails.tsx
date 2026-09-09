// Relative Path: ./SurveillanceDetails.tsx
import React, { useEffect, useState } from 'react';
import styles from './SurveillanceDetails.scss';
import UiMedia from '@webstack/components/UiMedia/controller/UiMedia';
import SurveillanceController from '../SurveillanceController/SurveillanceController';
import { useRouter } from 'next/router';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import environment from '~/src/core/environment';
import UiLoader from '@webstack/components/UiLoader/view/UiLoader';
import DetectionPanel from '../DetectionPanel/DetectionPanel';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import ToggleSwitch from '@webstack/components/UiForm/components/UiToggle/UiToggle';
import { getService } from '@webstack/common';
import ISurveillanceService from '~/src/core/services/SurveillanceService/ISurveillanceService';

// Remember to create a sibling SCSS file with the same name as this component
interface ISurveillanceDetails {
  camera?: any
}
const SurveillanceDetails: React.FC<ISurveillanceDetails> = ({ camera }: ISurveillanceDetails) => {
  const [detect, setDetect] = useState(false);
  const surveillance = getService<ISurveillanceService>('ISurveillanceService');
  // const isprod = environment?.isProduction;

  useEffect(() => { }, [camera]);

  if (!camera?.name_uri) return (
    <div style={{ width: "100%" }}>
      <UiLoader text={`${camera?.name_uri} failed`} dots={false} />
    </div>
  );



  return (
    <>
      <style jsx>{styles}</style>
      <div className="surveillance-details">
        <div className="surveillance-details__header">
          <UiButton
            traits={{ width: "100px", beforeIcon: "fa-chevron-left" }}
            variant="link"
            href={"/fleet/?vid=surveillance"}
          >
            back
          </UiButton>
          <div className="surveillance-details__header--title">{camera?.name_uri}</div>
        </div>
        <div className="surveillance-details__body">
          <div className="surveillance-details__body--media">
            <UiMedia
              type="video"
              src={surveillance.streamUrl(camera.name_uri, 'hls')}
              alt="thumbnail"
              controls
              autoplay
              muted={false}
            />
          </div>

          {detect && <div className="surveillance-details__body--detections">
            <DetectionPanel cameraId={camera.name_uri} />
          </div>}
          <div className="surveillance-details__body--controls">
            <ToggleSwitch value={detect}
              name="detect"
              label="object detection"
              onChange={() => setDetect(!detect)} />
            <SurveillanceController
              cameraId={camera.name_uri}
              initialPtz={camera.ptz_position}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default SurveillanceDetails;
