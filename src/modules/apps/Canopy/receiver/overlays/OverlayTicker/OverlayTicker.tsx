import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './OverlayTicker.scss';
/* Theme merged locally into component stylesheet */
import UiMarkdown, { UiMarkdownProps } from '@webstack/components/UiMarkDown/controller/UiMarkDown';
import { OverlayTitle } from '../OverlayScoreBoard/OverlayScoreBoard';

type TickerItem =
  | string
  | number
  | UiMarkdownProps
  | React.ReactElement
  | null
  | undefined;

interface OverlayTickerProps {
  items: TickerItem[];
  direction?: 'ltr' | 'rtl';
  variant?: string | null;
  pauseOnHover?: boolean;
  durationSec?: number;
  speedPxPerSec?: number;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: OverlayTitle;
  subTitle?: TickerItem;
  fontSize?: number | string; // drives --font-size
}

function isUiMarkdownProps(x: unknown): x is UiMarkdownProps {
  return !!x && typeof x === 'object' && 'text' in (x as Record<string, unknown>);
}

const OverlayTicker: React.FC<OverlayTickerProps> = ({
  items,
  direction = 'ltr',
  variant = 'default',
  pauseOnHover = true,
  durationSec,
  speedPxPerSec = 50,
  ariaLabel = 'News ticker',
  className = '',
  style,
  title,
  subTitle,
  fontSize,
}) => {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rowWidth, setRowWidth] = useState(800);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = rowRef.current;
    const root = rootRef.current;
    if (!el || !root) return;

    const toPx = (v?: number | string) =>
      v == null ? undefined : typeof v === 'number' ? `${v}px` : v;

    const measure = () => {
      const w = Math.ceil(el.scrollWidth);
      setRowWidth(w);

      root.style.setProperty('--row-width', `${w}px`);
      root.style.setProperty('--track-width', `${w * 2}px`);

      const fs = toPx(fontSize);
      if (fs) root.style.setProperty('--font-size', fs);

      const dur =
        durationSec && durationSec > 0 ? durationSec : Math.max(6, w / Math.max(1, speedPxPerSec));
      root.style.setProperty('--duration', `${dur}s`);

      // If we have a badge, reserve space on the left so content isn't covered
      const badge = badgeRef.current;
      if (badge) {
        // Temporarily show for measure if display none (it isn't)
        const bw = Math.ceil(badge.getBoundingClientRect().width);
        const offset = Math.max(0, bw + 16); // include a little gap
        root.style.setProperty('--badge-offset', `${offset}px`);
      } else {
        root.style.setProperty('--badge-offset', `0px`);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [durationSec, speedPxPerSec, items, fontSize]);

  const dirClass = direction === 'rtl' ? 'overlay-ticker--rtl' : 'overlay-ticker--ltr';
  const hoverClass = pauseOnHover ? 'overlay-ticker--pause-on-hover' : '';

  const renderItem = (it: TickerItem, key: React.Key) => {
    if (it == null) return null;

    if (React.isValidElement(it)) {
      return (
        <span key={key}>
          <style jsx>{styles}</style>
          <span className="overlay-ticker__item">{it}</span>
        </span>
      );
    }

    if (typeof it === 'string' || typeof it === 'number') {
      return (
        <span key={key}>
          <style jsx>{styles}</style>
          <span className="overlay-ticker__item">
            <UiMarkdown text={String(it)} jsxClass="ui-markdown" />
          </span>
        </span>
      );
    }

    if (isUiMarkdownProps(it)) {
      const cls = ['ui-markdown', it.jsxClass].filter(Boolean).join(' ');
      return (
        <span key={key}>
          <style jsx>{styles}</style>
          <span className="overlay-ticker__item">
            <UiMarkdown {...it} jsxClass={cls} />
          </span>
        </span>
      );
    }

    return (
      <span key={key}>
        <style jsx>{styles}</style>
        <span className="overlay-ticker__item">
          <UiMarkdown text={String(it)} jsxClass="ui-markdown" />
        </span>
      </span>
    );
  };

  const Row = useMemo(
    () => (
      <span key="row-wrap">
        <style jsx>{styles}</style>
        <div className="overlay-ticker__row" ref={rowRef}>
          {items.map((it, i) => renderItem(it, `item-${i}`))}
        </div>
      </span>
    ),
    [items]
  );

  // Build variant class based on variant prop
  const variantClass = useMemo(() => {
    if (!variant || variant === 'default') return '';
    // Support: blank, image-left, image-right, fullscreen
    return `overlay-ticker--${variant}`;
  }, [variant]);

  return (
    <>
      {/* Component styles */}
      <style jsx>{styles}</style>
      <div
        ref={rootRef}
        className={`overlay-ticker ${dirClass} ${hoverClass} ${variantClass} ${className}`.trim()}
        role="marquee"
        aria-label={ariaLabel}
        style={style}
        id="overlay-ticker"
      >
        {/* floating badge (top-left) */}
        {(title || subTitle) && (
          <div className="overlay-ticker__badge" ref={badgeRef} aria-hidden="false">
            {/* Title rendered via UiMarkdown when present */}
            {(() => {
              const titleText =
                typeof title === 'string' || typeof title === 'number'
                  ? String(title)
                  : title && typeof title === 'object'
                    ? String((title as any)?.text ?? '')
                    : '';
              return titleText ? (
                <span className="overlay-ticker__badge-title">
                  <UiMarkdown text={titleText} jsxClass="ui-markdown" />
                </span>
              ) : null;
            })()}

            {subTitle ? (
              <span className="overlay-ticker__badge-sub">
                {React.isValidElement(subTitle) ? (
                  subTitle
                ) : typeof subTitle === 'string' || typeof subTitle === 'number' ? (
                  <UiMarkdown text={String(subTitle)} jsxClass="ui-markdown" />
                ) : isUiMarkdownProps(subTitle) ? (
                  <UiMarkdown {...(subTitle as UiMarkdownProps)} jsxClass="ui-markdown" />
                ) : null}
              </span>
            ) : null}
          </div>
        )}

        {/* track */}
        <span>
          <div className="overlay-ticker__track" aria-hidden={rowWidth <= 0}>
            {Row}
            <span key="row-clone-wrap">
              <div
                className="overlay-ticker__row overlay-ticker__row--clone"
                aria-hidden="true"
              >
                {items.map((it, i) => renderItem(it, `clone-${i}`))}
              </div>
            </span>
          </div>
        </span>
      </div>
    </>
  );
};

export default OverlayTicker;