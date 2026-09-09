import React, { useEffect, useState } from 'react';
import styles from './BackcountryNetwork.scss';
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

const BackcountryNetwork = () => {
  const { pathname } = useRouter();
  const [currentVessel, setCurrentVessel] = useState<IVessel | false | undefined>();
  const { layout, setLayout } = useLayout();
  const { width } = useWindow()
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
      <div className="deepturn__glb">
        <AdaptGrid sm={1} md={2}>
        {/* <UiFilter
          variant='crt'
          element={



          }
          /> */}
            <div className='s-9 d-flex z-2'>
              <div className="deepturn__glb--heading">
                <h1>Welcome to Backcountry Network</h1>
                <UiMarkdown text={
                  useBuildInfo()
                } />
                {/* <p>{}</p> */}
              </div>
              </div>
            <div className='s-9 d-flex z-1 '>
<div className='p-absolute' style={{position:"absolute"}}>
              <GLBViewer
                wireframe
                width={1600}
                height={1500}
                wireframeColor='#ffffff'
                modelPath={`${process.env.NEXT_PUBLIC_FILESERVER_BASE_URL ?? "https://mb1-orch-1.tiktok.soy/files/"}srv/mb1/models/deepturn.glb`}

                // modelPath={`${"https://mb1-orch-1.tiktok.soy/files/"}srv/mb1/products/BottleOpener/BottleOpener.glb`}
                // children={
                  //   <UiFilter text={`<div className="d-flex-col"><h1>HELLO DEEPTURN</h1> <br/> <p>${useBuildInfo()}</p></div>`} variant='crt' />

                  // }
                  />
                  </div>
            </div>
          </AdaptGrid>
        {/* <GLBViewer
        wireframe
        wireframeColor='var(--gray-100)'
          modelPath={`${"https://mb1-orch-1.tiktok.soy/files/"}srv/mb1/models/deepturn.glb`}
          // modelPath={`${"https://mb1-orch-1.tiktok.soy/files/"}srv/mb1/products/BottleOpener/BottleOpener.glb`}
          children={
            <UiFilter text={`<div className="d-flex-col"><h1>HELLO DEEPTURN</h1> <br/> <p>${useBuildInfo()}</p></div>`} variant='crt' />

          }
        /> */}
        </div>

      {/* <UiMedia variant='background' src="/assets/backgrounds/space_ghost.gif"  style={{ left: `${bgLeft}px` }} /> */}
      {/* </div> */}
      {/* </div> */}
      <MBWaterMark />
      </div>

    </>
  );
};

export default BackcountryNetwork;
