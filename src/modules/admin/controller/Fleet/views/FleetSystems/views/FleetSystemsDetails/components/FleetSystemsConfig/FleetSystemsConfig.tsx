// FleetSystemsConfig is now a thin composition: each panel is its own
// component under ./components, owns its own draft state, and pulls
// network-wide model from the FleetSystems context.
import React, { useCallback, useRef } from 'react';
import styles from './FleetSystemsConfig.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiRadioLayout, { UiRadioLayoutView } from '@webstack/layouts/UiRadioLayout/controller/UiRadioLayout';
import { useFleetSystems } from '../../../../controller';

import ConfigIdentity from './components/ConfigIdentity/ConfigIdentity';
import ConfigSelfUpdate from './components/ConfigSelfUpdate/ConfigSelfUpdate';
import ConfigEditableHost from './components/ConfigEditableHost/ConfigEditableHost';
import ConfigAppEnv from './components/ConfigAppEnv/ConfigAppEnv';
import ConfigSecrets from './components/ConfigSecrets/ConfigSecrets';
import ConfigFleet from './components/ConfigFleet/ConfigFleet';
import ConfigManagePanel from './components/ConfigManagePanel/ConfigManagePanel';
import ConfigNetworkHistory from './components/ConfigNetworkHistory/ConfigNetworkHistory';

const FleetSystemsConfig: React.FC = () => {
  const {
    selectedHostKey,
    deviceConfig,
    deviceConfigLoading,
    deviceConfigSaving,
    saveDeviceConfig,
    networkHistory,
    networkAdmin,
    refreshingNetwork,
    refreshNetwork,
    fleetConfig,
    fleetConfigLoading,
    fleetConfigSaving,
    loadFleetConfig,
    saveFleetConfig,
    removeFleetConfig,
    revealFleetSecret,
    revealHostSecret,
  } = useFleetSystems();

  const handleRefresh = useCallback(() => {
    if (!selectedHostKey) return;
    refreshNetwork(selectedHostKey);
  }, [refreshNetwork, selectedHostKey]);

  // Lazy-load the fleet config exactly once when the user first opens the fleet tab.
  const fleetLoaded = useRef(false);
  const handleViewChange = useCallback((viewId: string) => {
    if (viewId === 'fleet' && !fleetLoaded.current) {
      fleetLoaded.current = true;
      loadFleetConfig();
    }
  }, [loadFleetConfig]);

  if (!selectedHostKey) return null;

  const observedAt = deviceConfig?.network_observed_at
    ? new Date(deviceConfig.network_observed_at).toLocaleString()
    : 'never';

  const views: UiRadioLayoutView[] = [
    {
      id: 'host',
      label: 'Host',
      content: (
        <div className="d-flex-col s-9 align-start">
          <div className="d-flex-col s-9 align-start">
            <h3>fleet self-update</h3>
            <ConfigSelfUpdate
              config={deviceConfig}
              hostKey={selectedHostKey}
              saving={deviceConfigSaving}
              onSave={saveDeviceConfig}
            />
          </div>
          <div className="d-flex-col s-9 align-start">
            <ConfigEditableHost
              hostKey={selectedHostKey}
              config={deviceConfig}
              loading={deviceConfigLoading}
              saving={deviceConfigSaving}
              onSave={saveDeviceConfig}
            />
          </div>
          <div className="d-flex-col s-9 align-start">
            <h3>where to manage</h3>
            <ConfigManagePanel networkAdmin={networkAdmin} />
          </div>
        </div>
      ),
    },
    {
      id: 'env',
      label: 'app_env',
      content: (
        <div className="d-flex-col s-9 align-start">
          <h3>app_env (host-scoped)</h3>
          <ConfigAppEnv
            config={deviceConfig}
            saving={deviceConfigSaving}
            onSave={saveDeviceConfig}
          />
        </div>
      ),
    },
    {
      id: 'secrets',
      label: 'Secrets',
      content: (
        <div className="d-flex-col s-9 align-start">
          <h3>secrets (host-scoped)</h3>
          <ConfigSecrets
            hostKey={selectedHostKey}
            config={deviceConfig}
            saving={deviceConfigSaving}
            onSave={saveDeviceConfig}
            onReveal={revealHostSecret}
          />
        </div>
      ),
    },
    {
      id: 'fleet',
      label: 'Fleet config',
      content: (
        <div className="d-flex-col s-9 align-start">
          <h3>fleet system_config</h3>
          <ConfigFleet
            rows={fleetConfig as any[]}
            loading={fleetConfigLoading}
            saving={fleetConfigSaving}
            onLoad={loadFleetConfig}
            onSave={saveFleetConfig}
            onDelete={removeFleetConfig}
            onRevealSecret={revealFleetSecret}
          />
        </div>
      ),
    },
    {
      id: 'network',
      label: 'Network',
      content: (
        <div className="d-flex-col s-9 align-start">
          <h3>router history</h3>
          <ConfigNetworkHistory history={networkHistory as any[]} />
        </div>
      ),
    },
  ];

  return (
    <>
      <style jsx>{styles}</style>
      <div className="fleet-systems-config">
        <div className="fleet-systems-config__header">
          <div className="fleet-systems-config__title">device config · {selectedHostKey}</div>
          <div className="fleet-systems-config__meta">
            <span>network observed: {observedAt}</span>
            <UiIcon
              icon="fa-arrows-rotate"
              spin={refreshingNetwork}
              alt="Refresh network posture"
              onClick={handleRefresh as any}
            />
          </div>
        </div>

        <ConfigIdentity config={deviceConfig} />

        <UiRadioLayout
          views={views}
          defaultValue="host"
          collapsed={false}
          onViewChange={handleViewChange}
          layout={{ orientation: 'vertical', navigationPosition: 'top' }}
        />
      </div>
    </>
  );
};

export default FleetSystemsConfig;
