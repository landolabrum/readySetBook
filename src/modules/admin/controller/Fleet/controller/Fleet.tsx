// Relative Path: ./Fleet.tsx
import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import styles from './Fleet.scss';
import Surveillance from '../../../../home/views/surveillance/controller/Surveillance';
import LightsList from '../../../../home/views/hue/controller/Lights';
import Spotify from '../../../../home/views/spotify/controller/Spotify';
import FleetSystems from '../views/FleetSystems/controller/FleetSystems';
import FleetDataBase from '../views/FleetDataBase/controller/FleetDataBase';
import AdminFlipper from '../views/AdminFlipper/controller/AdminFlipper';
import AdminRoutes from '../views/AdminRoutes/AdminRoutes';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';

// Remember to create a sibling SCSS file with the same name as this component

const DEFAULT_VIEW = 'systems';

const adminroute = (subroute: string): string => `/fleet/${subroute}`;

const Fleet: React.FC = () => {
  const router = useRouter();

  const views = useMemo(() => (
    {
      systems: <FleetSystems />,
      routes: <AdminRoutes />,
      lights: <LightsList />,
      flipper: <AdminFlipper />,
      surveillance: <Surveillance />,
      spotify: <Spotify />,
      database: <FleetDataBase />,
    }
  ), []);

  const slugParam = router.query.slug;
  const activeKey = (Array.isArray(slugParam) ? slugParam[0] : slugParam) || DEFAULT_VIEW;

  // Canonicalize the bare "/fleet/" index onto its default subroute so
  // the button group's self-link highlighting has a real match to compare against.
  useEffect(() => {
    if (!router.isReady || slugParam) return;
    router.replace(adminroute(DEFAULT_VIEW));
  }, [router, router.isReady, slugParam]);

  const btns = useMemo(() => (
    Object.keys(views).map((key) => ({ name: key, label: key, href: adminroute(key) }))
  ), [views]);

  const activeView = views[activeKey as keyof typeof views] ?? views[DEFAULT_VIEW];

  return (
    <>
      <style jsx>{styles}</style>
      <div className='fleet'>
        <div className='fleet__header'>
        <UiButtonGroup btnSize='sm' btns={btns}
        variant="bundle"
        />
        </div>
        <div className='fleet__content'>
          {activeView}
        </div>
      </div>
    </>
  );
};

export default Fleet;
