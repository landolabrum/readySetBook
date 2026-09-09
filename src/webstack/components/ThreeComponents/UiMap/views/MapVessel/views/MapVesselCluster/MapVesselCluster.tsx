import React from 'react';
import { IVessel } from '../../../../models/IMapVessel';
import MapVesselMarker from '../MapVesselMarker/MapVesselMarker';

interface IMapVesselCluster {
  /** Stable key for this coordinate bucket (used to scope the open state). */
  groupKey: string;
  /** Co-located vessels — always length > 1 when a cluster is rendered. */
  vessels: IVessel[];
  hideHover?: boolean;
  onClick?: (vessel: IVessel) => void;
  onMouseEnter?: (vessel: IVessel) => void;
  onMouseLeave?: (vessel: IVessel) => void;
}

// Radial fan geometry: members orbit the cluster bubble on a circle whose
// radius grows with the member count so a big stack doesn't overlap itself.
const fanPosition = (index: number, total: number): { x: number; y: number } => {
  const radius = Math.min(120, 46 + total * 6);
  const angle = (2 * Math.PI * index) / total - Math.PI / 2; // start at top
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
};

const COLLAPSED_TRANSFORM = 'translate(-50%, -50%) scale(0.35)';

// Markers are rendered via createRoot into detached mapbox DOM, so scoped
// (styled-jsx) show/hide rules aren't guaranteed to reach them. Collapse/expand
// is therefore driven by inline styles toggled imperatively — no stylesheet
// dependency for the core behavior; the .scss only adds cosmetics.
const setOpen = (root: HTMLElement, opened: boolean) => {
  const members = root.querySelectorAll<HTMLElement>('.vsl-cluster__member');
  members.forEach((el) => {
    if (opened) {
      const fx = el.dataset.fx || '0px';
      const fy = el.dataset.fy || '0px';
      el.style.transform = `translate(-50%, -50%) translate(${fx}, ${fy}) scale(1)`;
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    } else {
      el.style.transform = COLLAPSED_TRANSFORM;
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }
  });
  root.style.zIndex = opened ? '60' : '';
  const icon = root.querySelector<HTMLElement>('.vsl-cluster__icon');
  if (icon) icon.style.opacity = opened ? '0.4' : '1';
};

/**
 * A single map marker standing in for several vessels at the same coordinate.
 * Collapsed it shows one enlarged bubble with a member count; the members stay
 * hidden underneath it. Hovering or clicking the bubble fans the members out
 * radially so each member's own `.vsl-icon` + hover card becomes individually
 * reachable; leaving collapses them back.
 *
 * Rendered via a plain function call (like MapVesselMarker), so open/close is
 * driven imperatively rather than with React state.
 */
const MapVesselCluster: React.FC<IMapVesselCluster> = ({
  groupKey,
  vessels,
  hideHover = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const total = vessels.length;
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const memberTransition = reduceMotion
    ? 'none'
    : 'transform 220ms cubic-bezier(0.2, 0.8, 0.3, 1), opacity 180ms ease';
  let closeTimeout: number | undefined;

  const open = (root: HTMLElement) => {
    if (closeTimeout) window.clearTimeout(closeTimeout);
    setOpen(root, true);
  };
  const close = (root: HTMLElement) => {
    if (closeTimeout) window.clearTimeout(closeTimeout);
    // Grace delay so moving between the bubble and a fanned member (which sits
    // outside the collapsed hit-box) doesn't collapse the group mid-reach.
    closeTimeout = window.setTimeout(() => setOpen(root, false), 220);
  };

  return (
    <div
      className="vsl vsl-cluster"
      data-cluster={groupKey}
      tabIndex={0}
      style={{ position: 'relative' }}
      onMouseEnter={(e) => open(e.currentTarget)}
      onMouseLeave={(e) => close(e.currentTarget)}
      onFocus={(e) => open(e.currentTarget)}
      onBlur={(e) => close(e.currentTarget)}
      onClick={(e) => open(e.currentTarget)}
    >
      <div
        className="vsl-cluster__icon vsl-icon"
        aria-label={`${total} devices here — hover to expand`}
        style={{ cursor: 'pointer', transition: 'opacity 200ms ease' }}
      >
        <span className="vsl-cluster__count">{total}</span>
      </div>
      <div
        className="vsl-cluster__members"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {vessels.map((vessel, i) => {
          const { x, y } = fanPosition(i, total);
          return (
            <div
              key={String(vessel.id ?? i)}
              className="vsl-cluster__member"
              data-fx={`${x}px`}
              data-fy={`${y}px`}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: COLLAPSED_TRANSFORM,
                opacity: 0,
                pointerEvents: 'none',
                transition: memberTransition,
              }}
            >
              {MapVesselMarker({ vessel: { ...vessel, active: true }, onClick, onMouseEnter, onMouseLeave, hideHover })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MapVesselCluster;
