import React, { useEffect, useState } from 'react';
import styles from './Deepturn.scss';
// import UiMap from '@webstack/components/ThreeComponents/UiMap/controller/UiMap';
import { IVessel } from '@webstack/components/ThreeComponents/UiMap/models/IMapVessel';
import { useRouter } from 'next/router';

import UiMedia from '@webstack/components/UiMedia/controller/UiMedia';
import useWindow from '@webstack/hooks/window/useWindow';
import MBWaterMark from '../../../MindBurner/views/WaterMark/MBWaterMark';
import useLayout from '@webstack/layouts/default/hooks/useLayout';
import UiFilter from '@webstack/components/UiFilter/UiFilter';
import { useBuildInfo } from '@webstack/lib/project/BuildInfo/useBuildInfo';
import ThreeSTL from '@webstack/components/ThreeComponents/ThreeSTL/controller/THREESTL';
import GLBViewer from '@webstack/components/ThreeComponents/ThreeGLB/ThreeGLB';
import { TJSCube } from '@webstack/components/ThreeComponents/TJSCube/controller/TJSCube';
import AdaptGrid from '@webstack/components/Containers/AdaptGrid/AdaptGrid';
import UiMarkdown from '@webstack/components/UiMarkDown/controller/UiMarkDown';
import { useUser } from '~/src/core/authentication/hooks/useUser';
import keyStringConverter from '@webstack/helpers/keyStringConverter';

const Deepturn = () => {
  const { pathname } = useRouter();
  const [currentVessel, setCurrentVessel] = useState<IVessel | false | undefined>();
  const { layout, setLayout } = useLayout();
  const { width } = useWindow();
  const glbWidth = width> 1100?800:250;
  const user = useUser();
  const [bgLeft, setBgLeft] = useState<number>(typeof window !== 'undefined' ? (window.innerWidth / 2) : 0);
  const vessels: IVessel[] = [

    // ✅ New Antelope Point Marina marker
    {
      id: 2,
      name: 'Antelope Point Marina',
      lngLat: [-111.429722, 36.966389],
      className: 'partner',
      hover: 'Antelope Point Marina',
      description: (
        <UiMedia
          autoplay
          style={{ height: "100%" }}
          variant='background'
          type='iframe'
          src='https://www.youtube.com/embed/N9tH-8UOFas?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1'
        />
      ),
      // description:  <UiMedia type='iframe' src='https://www.youtube.com/embed/N9tH-8UOFas?si=OCakKGOAEY4yrkU5'/>,
      // description:  <></>
    }
  ];
  useEffect(() => {
    if (!layout?.background && pathname === "/") {
      setLayout({ background: "var(--black)" })
    } else {
      setLayout({ background: undefined })

    }
  }, [width, pathname]);



  // center the background over the app 'main' container center
  useEffect(() => {
    const compute = () => {
      try {
        const main = document.querySelector('main');
        if (main) {
          const r = (main as HTMLElement).getBoundingClientRect();
          setBgLeft(r.left + (r.width / 2));
        } else {
          setBgLeft(window.innerWidth / 2);
        }
      } catch (e) {
        setBgLeft(window.innerWidth / 2);
      }
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [width, pathname]);
  return (
    <>
      <style jsx>{styles}</style>
      <div className="deepturn">
        {/* {pathname === "/" && (
            // <UiMap
            //   onVesselClick={setCurrentVessel}
            //   require="location"
            //   options={{
              //     rpm: 1000,
              //     // hideTools: true,
              //     // loadingDelay: 3000,
              //     zoom:width>1260? 2.8: 3.8,
              //     pitch: 45,
              //     center: [-95, 43],
              //   }}
              //   vessels={vessels}
              // />
              )} */}
              <div className="deepturn--heading">
            <h1>HELLO {user?.last_name || user != undefined && keyStringConverter(user.name.split(" ")[0],{textTransform:"uppercase"}) || "DEEPTURN "}</h1>
              <div>
                <UiMarkdown text={
                  useBuildInfo()
                } />

                </div>
              </div>
            <div className="deepturn--glb">

              <GLBViewer
                wireframe
                width={glbWidth}
                height={glbWidth}
                wireframeColor='#ffffff'
                modelPath={`${process.env.NEXT_PUBLIC_FILESERVER_BASE_URL ?? "https://mb1-orch-1.tiktok.soy/files/"}srv/mb1/models/deepturn.glb`}

                // modelPath={`${"https://mb1-orch-1.tiktok.soy/files/"}srv/mb1/products/BottleOpener/BottleOpener.glb`}
                // children={
                  //   <UiFilter text={`<div className="d-flex-col"><h1>HELLO DEEPTURN</h1> <br/> <p>${useBuildInfo()}</p></div>`} variant='crt' />

                  // }
                  />
        </div>

      <MBWaterMark />
      </div>

    </>
  );
};

export default Deepturn;
