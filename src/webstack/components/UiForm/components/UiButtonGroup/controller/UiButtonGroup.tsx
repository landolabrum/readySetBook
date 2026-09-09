// src/webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import styles from './UiButtonGroup.scss';
import UiButton, { IButton } from '../../UiButton/UiButton';
import { IFormControlSize } from '../../FormControl/FormControl';
import UiHeader from '@webstack/components/Containers/Header/views/UiHeader/UiHeader';

export type UiButtonGroupDirection = 'ltr' | 'rtl' | 'ttb' | 'btt';

export interface IUiButtonGroup {
  label?: string | boolean | React.ReactElement;
  /** Group-level default variant; per-button `variant` overrides this */
  variant?: string; // e.g. "primary", "secondary", "bundle", "float-top-right" (layout-only)
  /** Flow direction: ltr (left-to-right), rtl (right-to-left), ttb (top-to-bottom), btt (bottom-to-top) */
  direction?: UiButtonGroupDirection;
  size?: any;
  btnSize?: IFormControlSize;
  btns?: IButton[];
  onSelect?: (e: any) => void;
}

/** Layout-only variants that should NOT cascade to items as theme variants */
const LAYOUT_ONLY_VARIANTS = new Set(['bundle', 'float-top-right']);
const btnContent = (btn:IButton)=>{
    return typeof btn?.label === 'string'
    ? btn.label
    : (typeof btn?.label === 'object' && (btn.label as any)?.text) || btn?.name || ''
}
/** Deep-ish equality used just to avoid unnecessary setState thrash */
const shallowEqualArray = (a?: any[], b?: any[]) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (
      x?.name !== y?.name ||
      x?.label !== y?.label ||
      x?.checked !== y?.checked ||
      x?.variant !== y?.variant ||
      x?.disabled !== y?.disabled ||
      x?.traits?.variant !== y?.traits?.variant
    ) {
      return false;
    }
  }
  return true;
};

/** Resolve the visual variant for one button with sensible precedence */
const resolveItemVariant = (
  butt: IButton | undefined,
  groupVariant?: string
): string | undefined => {
  if (!butt) return LAYOUT_ONLY_VARIANTS.has(groupVariant || '') ? undefined : groupVariant;
  // precedence: button.variant -> button.traits.variant -> group.variant* -> (checked? primary : flat) -> undefined
  // *group.variant is ignored if it's layout-only (e.g. "bundle")
  const groupTheme = LAYOUT_ONLY_VARIANTS.has(groupVariant || '') ? undefined : groupVariant;
  return (
    (butt as any).variant ??
    (butt as any)?.traits?.variant ??
    groupTheme ??
    (typeof butt.checked === 'boolean' ? (butt.checked ? 'transparent' : 'flat') : 'transparent')
  );
};

const UiButtonGroup: React.FC<IUiButtonGroup> = ({ label, btns, size, btnSize, onSelect, variant, direction }) => {
  const defaultOptions = useMemo(() => [{ label: 'loading' }, { label: 'loading' }, { label: 'loading' }], []);
  const [localBtns, setLocalBtns] = useState<IButton[]>(
    () => (Array.isArray(btns) && btns.length ? btns : (defaultOptions as any))
  );

  // Float-top-right: click-outside state
  const isFloatTopRight = variant === 'float-top-right';
  const [isOpen, setIsOpen] = useState(false);
  const floatRef = useRef<HTMLDivElement>(null);

  // Click outside handler for float-top-right variant
  useEffect(() => {
    if (!isFloatTopRight || !isOpen) return;
    alert(1)

    const handleClickOutside = (e: MouseEvent) => {
      if (floatRef.current && !floatRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    // Small delay to prevent immediate close on the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFloatTopRight, isOpen!== undefined]);

  // Sync local list with props
  useEffect(() => {
    if (!Array.isArray(btns)) return;
    setLocalBtns((prev) => (shallowEqualArray(prev, btns) ? prev : btns));
  }, [btns]);

  // Re-resolve variants on group variant change (covers "bundle" + themes)
  useEffect(() => {
    setLocalBtns((prev) => [...prev]);
  }, [variant]);

  const handleSelect = useCallback(
    (e: any) => {
      const name: string | undefined =
        e?.target?.name ?? e?.currentTarget?.name ?? e?.target?.dataset?.name;
      if (!name) return;

      setLocalBtns((prev) => {
        const idx = prev.findIndex((b) => b?.name === name);
        if (idx < 0) return prev;

        const next = prev.slice();
        const curr = { ...next[idx] };

        // Toggle only when it's explicitly boolean
        if (typeof curr.checked === 'boolean') {
          curr.checked = !curr.checked;
        }

        next[idx] = curr;

        // Emit a synthetic event with the updated button as target/currentTarget
        const synthetic = {
          ...e,
          target: curr,
          currentTarget: curr,
          detail: { name: curr.name, checked: curr.checked, value: curr.value, variant: curr.variant },
        };
        onSelect?.(synthetic);

        // Invoke per-button onClick if present
        curr.onClick?.(synthetic);

        return next;
      });
    },
    [onSelect]
  );

  const groupVariantClass = variant ? `btn-group--${variant}` : '';
  const directionClass = direction ? `btn-group--dir-${direction}` : '';

  // Float-top-right variant: special rendering with slide-in behavior
  if (isFloatTopRight) {
    return (
      <>
        <style jsx>{styles}</style>
        {/* Backdrop overlay - dims and blurs background when open */}
        <div
          className="btn-group__backdrop"
          data-open={isOpen}
          onClick={() => setIsOpen(false)}
        />
        <div
          ref={floatRef}
          className={`btn-group ${groupVariantClass} ${directionClass}`}
          data-open={isOpen}
          onClick={() => !isOpen && setIsOpen(true)}
        >
          <div className="btn-group__float-row">
            {localBtns.map((butt, index) => {
              const key = (butt?.name as string) ?? String(index);


              return (
                <div key={index + key} className="btn-group__item">
                  {/* hi */}
                  <UiButton
                    name={butt?.name}
                    size={btnSize}
                    onClick={(e) => {
                      // console.log("[ e ]",{e})
                      e.stopPropagation();
                      handleSelect(e);
                    }}
                    traits={butt?.traits}
                    value={butt?.value}
                    type={butt?.type}
                    // disabled={butt?.disabled}
                    // variant={itemVariant}
                    busy={butt?.busy||localBtns === (defaultOptions as any)}
                  >
                    {btnContent(butt)}
                  </UiButton>

                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  return (<>
    <style jsx>{styles}</style>
    <div className={`btn-group ${groupVariantClass} ${directionClass}`}>
      {label && (
        <div className="btn-group--header">
          <div className="btn-group--header__title">
            {typeof label === 'string' ? label : <UiHeader title="" />}
          </div>
        </div>
      )}

      <div className="btn-group--content">
        <div className="btn-group__row">
          {localBtns.map((btn, index) => {
            const key = (btn?.name as string) ?? String(index);
            const isActive = btn?.checked === true;
            const isInactive = btn?.checked === false;
            const itemVariant = resolveItemVariant(btn, variant);
            // isActive && console.log(itemVariant)
            return (
              <div
                key={index + key}
                className={[
                  'btn-group__item',
                  itemVariant ? `btn-group__item--${itemVariant} ${btn?.disabled ?'btn-group__item--disabled':''}` : '',
                  isActive ? 'active' : '',
                  isInactive ? 'inactive' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={(ev) => {
                  if (isInactive) ev.currentTarget.classList.add('sunglass-text', 'sunglass-wipe');
                }}
                onMouseLeave={(ev) => {
                  if (isInactive) ev.currentTarget.classList.remove('sunglass-text', 'sunglass-wipe');
                }}
              >
                <UiButton
                  name={btn?.name}
                  size={btnSize}
                  key={key}
                  onClick={handleSelect}

                  traits={btn?.traits || (btn?.checked ? { afterIcon: 'fa-check' } : btn?.traits?.afterIcon)}
                  value={btn?.value}
                  href={btn?.href}
                  type={btn?.type}
                  // disabled={butt?.disabled}
                  variant={itemVariant}
                  busy={localBtns === (defaultOptions as any)}
                >
                  {btnContent(btn)}
                </UiButton>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  </>

  );
};

export default UiButtonGroup;
