import React from 'react';
import { IVessel } from '../../../../models/IMapVessel';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';

interface IMapVessel {
  vessel?: IVessel & { hover?: React.ReactNode };
  hideHover?: boolean;
  onMouseEnter?: (vessel: IVessel) => void;
  onMouseLeave?: (vessel: IVessel) => void;
  onClick?: (vessel: IVessel) => void;
}

const MapVesselMarker: React.FC<IMapVessel> = ({
  vessel,
  hideHover = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  if (!vessel) return null;

  const baseMarkerClasses = vessel.className
    ? vessel.className
        .split(/\s+/)
        .filter(Boolean)
        .map((cls) => `${cls}-mrkr`)
    : [];
  const isGuardianMarker = vessel.className?.includes("guardian__marker");
  const isTracking = Boolean(vessel?.meta?.isTracking);
  if (isTracking && isGuardianMarker) {
    baseMarkerClasses.push("guardian__marker-mrkr--tracking");
  }
  if (vessel.isMain && isGuardianMarker) {
    baseMarkerClasses.push("guardian__marker-mrkr--main");
  }
  const initialVesselClass = ["vsl", ...baseMarkerClasses].join(" ").trim();
  const isUser = vessel.className === 'user';
  let hoverTimeout: number | undefined;

  const handleAction = (action: 'enter' | 'leave') => {
    const el = document.getElementById(`vsl-${vessel.id}`);
    if (!el) return;

    if (action === 'enter') {
      if (!hideHover) {
        el.classList.add('vsl-mrkr--hover');
        // Flip the card to the left of the icon when the marker sits on the
        // right side of the map, so the expanded content never opens
        // off-screen / under the side panel. Measured only on hover (when the
        // card actually reveals) — no cost while the map pans or zooms.
        const root = el.closest('.vsl') as HTMLElement | null;
        const mapEl = el.closest('.mapboxgl-map') as HTMLElement | null;
        if (root && mapEl) {
          const iconRect = (root.querySelector('.vsl-icon') || root).getBoundingClientRect();
          const mapRect = mapEl.getBoundingClientRect();
          const centerRatio = (iconRect.left + iconRect.width / 2 - mapRect.left) / mapRect.width;
          el.classList.toggle('vsl-mrkr--flip', centerRatio > 0.6);
        }
      }
      onMouseEnter?.(vessel);
    } else if (action === 'leave') {
      // Clear any pending resets to avoid flicker cascades
      if (hoverTimeout) window.clearTimeout(hoverTimeout);
      hoverTimeout = window.setTimeout(() => {
        el.className = 'vsl-mrkr';
        onMouseLeave?.(vessel);
      }, 250); // tighter than 2000ms to reduce "stuck hover" feel
    }
  };

  const handleRootClick = (event: React.MouseEvent<HTMLDivElement>) => {
    handleAction("enter");
    onClick?.(vessel);
    (event.currentTarget as HTMLDivElement).focus();
  };

  const handleRootFocus = () => handleAction('enter');
  const handleRootBlur = () => handleAction('leave');

  return (
    <div
      tabIndex={0}
      onFocus={handleRootFocus}
      onBlur={handleRootBlur}
      onMouseEnter={() => handleAction('enter')}
      onClick={handleRootClick}
      className={initialVesselClass}
      onMouseLeave={() => handleAction('leave')}
    >
      <div className="vsl-icon">
        <UiIcon glow={isUser} icon={isUser ? 'fal-circle-user' : vessel?.icon ? vessel.icon : 'fa-location-dot'} />
      </div>

      <div id={`vsl-${vessel.id}`} className="vsl-mrkr">
        <div className="vsl-mrkr--content">
          {vessel.hover ?? (
            <div className="vsl-mrkr--content-header">
              <div className='dev'>{vessel.name}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
// guardian__marker-mrkr--tracking
export default MapVesselMarker;
