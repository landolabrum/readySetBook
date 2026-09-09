

// Relative Path: ./FleetSystems.tsx
import React, { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import styles from './FleetSystems.scss';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';
import FleetSystemsDevices from '../views/FleetSystemsDevices/controller/FleetSystemsDevices';
// import FleetSystemsConfig from '../views/FleetSystemsConfig/FleetSystemsConfig';
import { FleetSystemsProvider, useFleetSystems } from './context/FleetSystemsContext';
import useScroll from '@webstack/hooks/useScroll';
import FleetSystemsDevicesTotal from '../views/FleetSystemsDevices/views/FleetSystemsDevicesTotal/views/FleetSystemsDevicesTotal';


const FleetSystemsContent: React.FC = () => {
  const {
    hosts,
    selectedHostKey,
    systemData,
    range,
    loading,
    setRange,
    selectHost,
    refresh,
  } = useFleetSystems();
  const [scroll, setScroll]=useScroll();
  const router = useRouter();

  // Keep the selected host mirrored in ?host= so device links are
  // shareable/bookmarkable and survive a refresh.
  useEffect(() => {
    if (!router.isReady) return;
    const hostParam = Array.isArray(router.query.host) ? router.query.host[0] : router.query.host;
    if (hostParam && hostParam !== selectedHostKey) {
      selectHost(hostParam);
    }
    // Only react to the URL changing — selectedHostKey/selectHost are read, not deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.host]);

  const handleSelectHost = useCallback((hostKey: string) => {
    selectHost(hostKey);
    if (!router.isReady) return;
    router.replace(
      { pathname: router.pathname, query: { ...router.query, host: hostKey } },
      undefined,
      { shallow: true },
    );
  }, [selectHost, router]);

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const selectedName = hosts.find(h => h.host_key === selectedHostKey)?.display_name || selectedHostKey;

  const rangeButtons = useMemo(() => [
    {
      name: 'hour',
      traits: { afterIcon: { icon: "fa-clock" } },
      label: 'Hourly',
      checked: range === 'hour',
      disabled: true,
    },
    {
      traits: { afterIcon: { icon: "fa-calendar" }},
      name: 'day',
      label: 'day',
      checked: range === 'day',
      disabled: loading,
    },
    {
      // busy: false,
      traits:{ afterIcon:{
        icon:loading?'fa-spinner':'fa-rotate-left'
      }},

      name: 'refresh',
      label: 'Refresh',
      disabled: loading,
    },
  ], [range, loading]);

  const handleButtonSelect = useCallback((e: any) => {
    const name = e?.target?.name || e?.detail?.name;
    if (name === 'hour' || name === 'day') {
      setRange(name);
    } else if (name === 'refresh') {
      handleRefresh();
    }
  }, [setRange, handleRefresh]);
  const notTop = scroll > 60;
  return (
    <>
      <style jsx>{styles}</style>
      <div className="fleet-systems">
        <div className={`fleet-systems__header ${notTop ?"fleet-systems__header--bump":""}`}>
          <div className="fleet-systems__title--container">
            <div className="fleet-systems__title">{
              selectedName||"fleet system"
            }{loading&&'...'}</div>
            {systemData?.timestamp && (<div className="fleet-systems__sub-title">

              <span className="fleet-systems__title--timestamp">
                {new Date(systemData.timestamp).toLocaleString()}
              </span>
            </div>)}
          </div>
          <div className='fleet-systems__stats'>

          <FleetSystemsDevicesTotal hosts={hosts} />

          </div>
          <UiButtonGroup
            btns={rangeButtons}
            onSelect={handleButtonSelect}
            variant="bundle"
            />
        </div>

        <FleetSystemsDevices
          hosts={hosts}
          selectedHostKey={selectedHostKey}
          onSelectHost={handleSelectHost}
          loading={loading}
        />

        {/* <FleetSystemsConfig /> */}



      </div>
    </>
  );
};

const FleetSystems: React.FC = () => (
  <FleetSystemsProvider>
    <FleetSystemsContent />
  </FleetSystemsProvider>
);

export default FleetSystems;
