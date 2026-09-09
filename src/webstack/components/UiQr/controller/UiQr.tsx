import React, { useEffect, useMemo, useRef } from 'react';
import styles from './UiQr.scss';
import { IUicon, UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';

export type UiQrVariant = 'square' | 'rounded' | 'dots';

export type UiQrProps = {
  srcUrl: string;                 // data to encode
  size?: number;                  // px size (square). default 256
  color?: string;                 // foreground color (hex or css)
  background?: string;            // background color (hex or css)
  variant?: UiQrVariant;          // visual treatment
  className?: string;
  /** If true, prefer <canvas> draw when a global QRCode is present. */
  preferCanvas?: boolean;
  /** alt text for accessibility (falls back to srcUrl) */
  alt?: string;
  /** Optional icon rendered centered over the QR code */
  icon?: IUicon;
};

/** Convert a css color (#rrggbb or rgb/rgba) into hex without '#', default fallback. */
const toHexNoHash = (input?: string, fallback = '000000') => {
  const s = String(input || '').trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) return s.replace('#', '').toLowerCase();
  // very small rgb() parser
  const m = s.match(/^rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\)$/i);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(v => Math.max(0, Math.min(255, Number(v) | 0)));
    return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  return fallback;
};

/**
 * UiQr – lightweight QR component.
 * Strategy:
 * 1) If window.QRCode is present and preferCanvas=true, render to a canvas.
 * 2) Otherwise, use a reliable image endpoint (qrserver.com) to render a PNG.
 */
const UiQr: React.FC<UiQrProps> = ({
  srcUrl,
  size = 256,
  color = '#000000',
  background = '#ffffff',
  variant = 'square',
  className,
  preferCanvas,
  alt,
  icon,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hexFg = useMemo(() => toHexNoHash(color, '000000'), [color]);
  const hexBg = useMemo(() => toHexNoHash(background, 'ffffff'), [background]);

  // Attempt canvas rendering when a global QRCode lib is present (optional)
  useEffect(() => {
    if (!preferCanvas) return;
    if (typeof window === 'undefined') return;
    const QR: any = (window as any).QRCode || (window as any).qrcode;
    if (!QR || !canvasRef.current) return;
    try {
      const el = canvasRef.current;
      const q = new QR(-1, icon ? 'H' : 'M');
      q.addData(srcUrl);
      q.make();
      const tileW = Math.floor(size / q.getModuleCount());
      const tileH = Math.floor(size / q.getModuleCount());
      const ctx = el.getContext('2d');
      if (!ctx) return;
      el.width = size; el.height = size;
      // bg
      ctx.fillStyle = `#${hexBg}`;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = `#${hexFg}`;
      for (let r = 0; r < q.getModuleCount(); r++) {
        for (let c = 0; c < q.getModuleCount(); c++) {
          if (q.isDark(r, c)) {
            ctx.fillRect(c * tileW, r * tileH, tileW, tileH);
          }
        }
      }
    } catch {
      // swallow and let <img> path show the code instead
    }
  }, [preferCanvas, srcUrl, size, hexFg, hexBg]);

  // Fallback image URL – no tracking, simple PNG
  // Use high error correction (H) when an icon overlay is present so the
  // centre can be partially obscured without breaking scanning.
  const imgSrc = useMemo(() => {
    const base = 'https://api.qrserver.com/v1/create-qr-code/';
    const params = new URLSearchParams({
      data: srcUrl,
      size: `${size}x${size}`,
      color: `${hexFg.substring(0, 6)}`,
      bgcolor: `${hexBg.substring(0, 6)}`,
      qzone: '1',
      format: 'png',
      ecc: icon ? 'H' : 'M',
    });
    return `${base}?${params.toString()}`;
  }, [srcUrl, size, hexFg, hexBg, icon]);

  const cls = `ui-qr${className ? ' ' + className : ''}`;
  const aria = alt || `QR code for ${srcUrl}`;

  // Size the icon to ~22% of the QR so it stays scannable.
  // Users can still override via icon.size.
  const iconSizeResolved = icon?.size ?? Math.round(size * 0.22);
  const iconOverlay = icon ? (
    <div
      className="ui-qr__icon"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `#${hexBg}`,
        borderRadius: Math.max(4, Math.round(size * 0.03)),
        padding: Math.max(2, Math.round(size * 0.02)),
        lineHeight: 1,
        pointerEvents: 'none',
      }}
    >
      <UiIcon {...icon} size={iconSizeResolved} />
    </div>
  ) : null;

  if (preferCanvas) {
    return (
      <>
        <style jsx>{styles}</style>
        <div className={cls} data-variant={variant} style={{ width: size, height: size }}>
          <canvas ref={canvasRef} className="ui-qr__canvas" role="img" aria-label={aria} />
          {iconOverlay}
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx>{styles}</style>
      <div className={cls} data-variant={variant} style={{ width: size, height: size }}>
        <img className="ui-qr__img" src={imgSrc} width={size} height={size} alt={aria} />
        {iconOverlay}
      </div>
    </>
  );
};

export default UiQr;

