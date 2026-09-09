// Relative Path: ./UiBadge.tsx
// Small status pill: icon + label, colored by variant. Boolean maps to ok/bad.
// Pass `value` to render a redactable dotted value (IP or hostname) instead
// of a plain label: only the first dot-segment is shown (e.g. `10.***.***.***`)
// until hovered (temporary reveal) or clicked (persistent reveal, toggles off
// on a second click). Pass `mask={false}` to show `value` unredacted.
import React, { useState } from 'react';
import styles from './UiBadge.scss';
import { UiIcon } from '../UiIcon/controller/UiIcon';

export type IStatusVariant = 'ok' | 'bad' | 'warn' | 'info' | 'unknown';

export interface IUiBadge {
  /** true → ok, false → bad, or a variant string. */
  status: boolean | IStatusVariant;
  /** Label node. Defaults to online/offline for boolean status. Ignored when `value` is set. */
  label?: React.ReactNode;
  /** Icon id; pass false to suppress. Defaults per variant. */
  icon?: string | false;
  /** Override icon color (defaults to inherit the variant text color). */
  color?: string;
  /** Raw dotted value (IP or hostname) to redact until revealed. */
  value?: string;
  /** Set false to show `value` unredacted (still just plain text, no hover/click). Defaults true. */
  mask?: boolean;
}

const toVariant = (status: boolean | IStatusVariant): IStatusVariant => {
  if (status === true) return 'ok';
  if (status === false) return 'bad';
  return status;
};

const DEFAULT_ICON: Record<IStatusVariant, string> = {
  ok: 'fa-circle-check',
  bad: 'fa-xmark',
  warn: 'fa-triangle-exclamation',
  info: 'fa-circle-info',
  unknown: 'fa-circle',
};

/** Redacts every dot-segment after the first: `10.1.2.3` -> `10.***.***.***`. */
const redact = (value: string): string => {
  const parts = value?.split('.');
  if (!parts || parts.length < 2) return value;
  return [parts[0], ...parts.slice(1).map(() => '***')].join('.');
};

const UiBadge: React.FC<IUiBadge> = ({ status, label, icon, color, value, mask = true }) => {
  const [revealed, setRevealed] = useState(false);
  const [hovering, setHovering] = useState(false);

  const variant = toVariant(status);
  const iconId = icon === false ? undefined : icon ?? DEFAULT_ICON[variant];

  const maskable = mask && value != null;
  const redacted = maskable ? redact(value as string) : undefined;
  const isRedacted = maskable && redacted !== value;
  const text = maskable
    ? (isRedacted && !revealed && !hovering ? redacted : value)
    : label ?? value ?? (typeof status === 'boolean' ? (status ? 'online' : 'offline') : undefined);

  const interactiveProps = isRedacted
    ? {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setRevealed((r) => !r);
        },
        onMouseEnter: () => setHovering(true),
        onMouseLeave: () => setHovering(false),
      }
    : {};

  return (
    <>
      <style jsx>{styles}</style>
      <div
        className={`ui-badge ui-badge--${variant}${isRedacted ? ' ui-badge--maskable' : ''}`}
        {...interactiveProps}
      >
        {iconId && <UiIcon icon={iconId} {...(color ? { color } : {})} />}
        {text != null && <div className="ui-badge__label">{text}</div>}
      </div>
    </>
  );
};

export default UiBadge;
