import React from 'react';
import styles from './FleetSystemsControls.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiBadge from '@webstack/components/UiBadge/UiBadge';
import { useFleetSystems } from '../../controller';

const FleetSystemsControls: React.FC = () => {
  const { gpioState, gpioLoading: loading, toggleGpioRelay: onToggleRelay } = useFleetSystems();
  if (!gpioState || !gpioState.relays?.length) return null;

  return (
    <>
      <style jsx>{styles}</style>
      <div className="fleet-systems-controls">
        <div className="fleet-systems-controls__grid">
          {gpioState.relays.map((relay) => (
            <div
              key={relay.id}
              className={`fleet-systems-controls__relay${relay.on ? ' fleet-systems-controls__relay--on' : ''}`}
              onClick={() => !loading && onToggleRelay(relay.id, !relay.on)}
            >
              <UiIcon
                icon={relay.on ? 'fa-toggle-on' : 'fa-toggle-off'}
                color={relay.on ? 'var(--green-30)' : 'var(--gray-50)'}
                width="100%"
                height={30}
              />
              <div className="fleet-systems-controls__relay__label">
                {relay.label}
              </div>
              <UiBadge status={relay.on ? 'ok' : 'unknown'} icon={false} label={relay.on ? 'on' : 'off'} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default FleetSystemsControls;
