// Relative Path: ./FleetSystemsDevices.tsx
import React, { useMemo, useState } from 'react';
import styles from './FleetSystemsDevices.scss';
import type { MetricRow } from '../../../helpers/types';
import FleetSystemsDevicesTable from '../views/FleetSystemsDevicesTable/FleetSystemsDevicesTable';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiBadge from '@webstack/components/UiBadge/UiBadge';
import UiViewLayout from '@webstack/layouts/UiViewLayout/controller/UiViewLayout';
import FleetSystemsDevicesTree from '../views/FleetSystemsDevicesTree/FleetSystemsDevicesTree';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';
import { buildTailnetIndex, resolveDeviceNetworks } from '../../../helpers/deviceVpn';
import { platformIcon } from '../../../helpers/platform';
import { STALE_THRESHOLD_MS, clampPct, timeAgo } from '../../../helpers/systemUtils';
import { networkIcon, networkVariant, formatGpu, lanIpOf, wanIpOf } from '../../../helpers/deviceRows';
import FleetSystemsDevicesMap from '../views/FleetSystemsDevicesMap/FleetSystemsDevicesMap';
import UiResizerLayout, { IResizerWindow } from '@webstack/layouts/UiResizerLayout/controller/UiResizerLayout';
import FleetSystemsDetails from '../../FleetSystemsDetails/controller/FleetSystemsDetails';
import { useFleetSystems } from '../../../controller/context/FleetSystemsContext';
import useWindow from '@webstack/hooks/window/useWindow';
import UiMenuFan from '@webstack/components/UiMenuFan/UiMenuFan';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
type HostRow = MetricRow & {
  host_key: string;
  display_name: string;
};

type Props = {
  hosts: HostRow[];
  selectedHostKey?: string;
  onSelectHost: (hostKey: string) => void;
  loading?: boolean;
};

const FleetSystemsDevices: React.FC<Props> = ({ hosts, selectedHostKey, onSelectHost, loading }) => {

  const {
    systemData, timeline, range, restarting, restartDocker,
    headlessStatus, toggleHeadless, headlessBusy,
    updateAll, updatingAll, updateScope, setUpdateScope,
    updateLogs, clearUpdateLogs,
    deviceConfig, deviceConfigSaving, serviceBusy, toggleService, saveDeviceConfig,
  } = useFleetSystems();
    const { width } = useWindow();
    const isMobile = width < 1100;
    const { openModal, replaceModal, closeModal, isModalOpen } = useModal();

  const deviceViews = ['table', 'list', 'circle', 'map'] as const;
  type DeviceView = typeof deviceViews[number];
  const [view, setView] = useState<DeviceView>('table');
  const tableData = useMemo(() => {
    if (!hosts?.length) return [];
    const tailnet = buildTailnetIndex(hosts);
    return hosts.map(h => {
      const identifier = h.display_name || h.host_key;
      const age = h.ts ? Date.now() - new Date(h.ts).getTime() : Infinity;
      const statusState = age < STALE_THRESHOLD_MS;
      const networks = resolveDeviceNetworks(h, tailnet);
      const localLanIp = lanIpOf(h);
      const localWanIp = wanIpOf(h);
      const tsNet = networks.find(n => n.name === 'Tailscale');
      const cfNet = networks.find(n => n.name === 'Cloudflare');
      const isOrch = h.role !== 'runner'
      // console.log(h)
      return {
        host_key: h.host_key,
        id: identifier,
        hardware:h.device_class,
        os: <UiIcon size={35}
            badge={!statusState && "!" || undefined}
            glow={!statusState}
            color={`var(--${statusState ? 'green' : 'red'}-30)`} icon={platformIcon(h)} />,
        role: <UiIcon
          size={35}
          alt={h.role}
          color={`var(--${isOrch ? 'blue' : 'pink'}-30)`}
          icon={isOrch ? "fa-wand-magic-sparkles" : "fa-rabbit-running"}
        />,
        // status:statusState? '🟢 online' : '🔴 stale',
        lan: (
          <UiBadge status={localLanIp !== 'na' ? 'info' : 'unknown'} icon="fa-network-wired" value={localLanIp} />
        ),
        wan: (
          <UiBadge status={localWanIp !== 'na' ? 'info' : 'unknown'} icon="fa-globe" value={localWanIp} />
        ),
        tailscale: tsNet ? (
          <UiBadge
            status={networkVariant(tsNet.state)}
            icon={networkIcon(tsNet)}
            value={tsNet.address}
            label={tsNet.address ? undefined : 'Tailscale'}
          />
        ) : (
          <span className="device-vpns device-vpns--none">none</span>
        ),
        cloudflare: cfNet ? (
          <UiBadge
            status={networkVariant(cfNet.state)}
            icon={networkIcon(cfNet)}
            value={cfNet.address}
            label={cfNet.address ? undefined : 'Cloudflare'}
          />
        ) : (
          <span className="device-vpns device-vpns--none">none</span>
        ),
        cpu: h.cpu_pct != null ? `${clampPct(h.cpu_pct).toFixed(1)}%` : '—',
        memory: h.mem_pct != null ? `${clampPct(h.mem_pct).toFixed(1)}%` : '—',
        gpu: formatGpu(h),
        last_seen: h.ts ? timeAgo(h.ts) : 'never',
        up_time: h.ts ? h?.extra?.os_info?.uptime : 'never',
      };
    });
  }, [hosts]);

  // A single fleet view (table/list/circle/map). Shared by the desktop
  // resizer pane and the mobile fullscreen modal.
  const renderFleetView = (v: DeviceView, select: (hostKey: string) => void) => {
    switch (v) {
      case 'circle': return <FleetSystemsDevicesTree view="radial" hosts={hosts} onSelectHost={select} />;
      case 'list': return <FleetSystemsDevicesTree view="tidy" hosts={hosts} onSelectHost={select} />;
      case 'map': return <FleetSystemsDevicesMap hosts={hosts} />;
      case 'table':
      default:
        return <FleetSystemsDevicesTable data={tableData} loading={loading} onSelectHost={select} />;
    }
  };

  // Mobile: picking a device in the modal drops back to its details view.
  const handleMobileSelectHost = (hostKey: string) => {
    onSelectHost(hostKey);
    closeModal();
  };

  const openFleetModal = (v: DeviceView) => {
    setView(v);
    const content = {
      title: `Fleet · ${v}`,
      variant: 'fullscreen' as const,
      dismissable: true,
      children: (
        <><style jsx>{styles}</style>
          <div className="fleet-systems-devices">
            {renderFleetView(v, handleMobileSelectHost)}
          </div>
        </>
      ),
    };
    if (isModalOpen) replaceModal(content);
    else openModal(content);
  };

  const devicesPaneActions = (
    <UiButtonGroup
      btns={deviceViews.map((b, i) => {
        return { name: b, label: b, checked: view === b, traits:{

        afterIcon:`fa-${b}`}
       }
      })}
      direction='ltr'
      btnSize="sm"
      variant="bundle"

      onSelect={(e: any) => {
        const next = e?.detail?.name ?? e?.target?.name;
        if (next) setView(next);
      }}
    />
  );

  const devicesPane = (<><style jsx>{styles}</style>
    <div className="fleet-systems-devices">
      <UiViewLayout
        currentView={view}
        views={{
          table: (
            <FleetSystemsDevicesTable
              data={tableData}
              loading={loading}
              onSelectHost={onSelectHost}
            />
          ),
          circle: <FleetSystemsDevicesTree view="radial" hosts={hosts} onSelectHost={onSelectHost} />,
          list: <FleetSystemsDevicesTree view="tidy" hosts={hosts} onSelectHost={onSelectHost} />,
          map: <FleetSystemsDevicesMap hosts={hosts} />,
        }}
      />
    </div>
    </>
  );
  const selectedName = hosts.find(h => h.host_key === selectedHostKey)?.display_name || selectedHostKey;
  const detailsPane = <FleetSystemsDetails
      systemData={{...systemData, display_name: selectedName}}
      timeline={timeline}
      range={range}
      loading={loading}
      onDockerRestart={restartDocker}
      dockerRestarting={restarting}
      headlessStatus={headlessStatus}
      onHeadlessToggle={toggleHeadless}
      headlessBusy={headlessBusy}
      onUpdateAll={updateAll}
      updatingAll={updatingAll}
      updateScope={updateScope}
      onUpdateScopeChange={setUpdateScope}
      updateLogs={updateLogs}
      onClearUpdateLogs={clearUpdateLogs}
      services={deviceConfig?.services}
      serviceBusy={serviceBusy}
      savingServices={deviceConfigSaving}
      onToggleService={toggleService}
      onSaveServices={(next) => saveDeviceConfig({ services: next })}
      />

  const windows: IResizerWindow[] = [
    {
      id: 'devices',
      defaultSize:'55%',
      minSize: 45,
      header: { title: `#### Fleet`, actions: devicesPaneActions },
      children: devicesPane,
    },
    {
      id: 'details',
      defaultSize: '45%',
      minSize: 60,
      // header: { title: `#### ${selectedName ?` ${selectedName} details`:''}` },
      children: detailsPane,
    },
  ];

  // Mobile: free up space — show only the selected device's details full-width
  // and expose the fleet views through a fan menu that opens each in a
  // fullscreen modal. Selecting a device closes the modal (handleMobileSelectHost).
  if (isMobile) {
    return (
      <>
        <style jsx>{styles}</style>
        <div className="fleet-systems-devices__mobile">
          {detailsPane}
          <UiMenuFan
            icon="fa-server"
            items={deviceViews.map(v => ({ icon: `fa-${v}`, label: v }))}
            onClick={(item) => openFleetModal(item.label as DeviceView)}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx>{styles}</style>
      <div className="fleet-systems-devices__resizer">
        <UiResizerLayout
          windows={windows}
          layout="horizontal"
          storageKey="fleet-systems-devices"
          minWindowSize={45}
        />
      </div>
    </>
  );
};

export default FleetSystemsDevices;