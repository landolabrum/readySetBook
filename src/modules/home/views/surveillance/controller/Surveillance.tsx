import React, { useState, useEffect, useCallback } from 'react';
import styles from './Surveillance.scss';
import AdaptGrid from '@webstack/components/Containers/AdaptGrid/AdaptGrid';
import { getService } from '@webstack/common';
import ISurveillanceService, { ISurveillanceCams } from '~/src/core/services/SurveillanceService/ISurveillanceService';
import SurveillanceDetails from '../views/SurveillanceDetails/SurveillanceDetails';
import { useRouter } from 'next/router';
import UiMedia from '@webstack/components/UiMedia/controller/UiMedia';
import useLayout from '@webstack/layouts/default/hooks/useLayout';
import UiLoader from '@webstack/components/UiLoader/view/UiLoader';

// Grid tiles refresh cached snapshots instead of holding a live decode open per
// cam — a persistent MJPEG per tile saturated the single API node and produced
// the "Loading failed" grid. Live video is opened only on the expanded cam.
const SNAPSHOT_REFRESH_MS = 5000;

const Surveillance: React.FC = () => {
  const { layout, setLayout } = useLayout();
  const { query, push, pathname } = useRouter();
  const queryId = query?.id;
  const surveillance = getService<ISurveillanceService>('ISurveillanceService');
  const [camData, setCamData] = useState<ISurveillanceCams | null>(null);
  const [main, setMain] = useState<any | undefined>();
  const [loading, setLoading] = useState(false);
  const [snapTick, setSnapTick] = useState(0);

  const handleMain = (id: string) => {
    const camName = id.toLowerCase();
    const cam = camData?.cameras[camName];
    if (!main || main?.name_uri !== cam?.name_uri) {
      setMain(cam);
    } else {
      setMain(undefined);
    }
  };

  const getCameras = useCallback(async () => {
    if (camData) return;
    try {
      const response = await surveillance.listCameras();
      setCamData(response);
    } catch (error) {
      console.error('[ SURVEILLANCE ]', error);
    }
  }, [surveillance, camData]);

  useEffect(() => {
    if (!camData) getCameras();
  }, [camData, getCameras]);

  // Refresh grid snapshots on a shared interval (server caches ~2s, so a 5s
  // tick is cheap). Only runs once cams are loaded.
  useEffect(() => {
    if (!camData?.cameras) return;
    const id = window.setInterval(() => setSnapTick((t) => t + 1), SNAPSHOT_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [camData?.cameras]);

  useEffect(() => {
    if (!layout?.background || layout?.background !== "#130907") {
      setLayout({ background: "#130907" });
    }
  }, [camData]);

  if (!camData?.cameras) {
    return (
      <>
        <style jsx>{styles}</style>
        <div className="surveillance">

          <UiLoader text="fetching cams..."/>
          {/* <div className="surveillance__header">No cameras found</div> */}
        </div>
      </>
    );
  }
  return (
    <>
      <style jsx>{styles}</style>
      <div className="surveillance">

        {loading && <div className="loading-indicator">Refreshing...</div>}

        <>
          <div className="surveillance__header">
            <AdaptGrid xs={2} md={3} variant="card" gap={10}>
              {["available", "enabled", "total"].map((d: any) => (
                <div key={d}>
                  {d}: {camData[d as 'available' | 'enabled' | 'total']}
                </div>
              ))}
            </AdaptGrid>
          </div>
          {main && (
            <div className="surveillance__details">
              <SurveillanceDetails camera={main} />
            </div>
          )}
          <div className="surveillance__list">
          <AdaptGrid xs={1} md={3} lg={4} xl={6} >
            {!loading &&
              Object.values(camData.cameras).map((camera: any, idx: number) => {
                const isMain = main?.name_uri === camera.name_uri;
                return (
                  <div key={idx} className={`surveillance__item${isMain ? ' surveillance__item--active' : ''}`}>
                    <div

                      title={camera.name_uri} className="surveillance__item--header">{camera.name_uri}</div>
                    <div className="surveillance__details">
                      <UiMedia
                        onClick={() => handleMain(camera.name_uri)}
                        src={surveillance.snapshotUrl(camera.name_uri, snapTick)}
                        alt="thumbnail"
                      />
                    </div>
                  </div>
                );
              })}
          </AdaptGrid>
          </div>
        </>

      </div>
    </>
  );
};

export default Surveillance;
