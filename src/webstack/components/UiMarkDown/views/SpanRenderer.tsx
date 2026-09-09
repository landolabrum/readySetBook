/**
 * SpanRenderer – custom ReactMarkdown component for <span> elements.
 *
 * Detects data-attributes injected by the token pipeline and renders
 * the appropriate component (UiIcon, UiQr) instead of a plain <span>.
 */
import React from 'react';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiQr from '@webstack/components/UiQr/controller/UiQr';
import type { IUicon } from '@webstack/components/UiIcon/controller/UiIcon';

const SpanRenderer = ({ node, ...props }: any) => {
    const p: any = props || {};

    // ── QR code token ──────────────────────────────────────────────────
    const qrUrl = p['data-qr'] || node?.properties?.['data-qr'];
    if (qrUrl) {
        const size = p['data-size'] ?? node?.properties?.['data-size'];
        const color = p['data-color'] || node?.properties?.['data-color'];
        const bg = p['data-bg'] || node?.properties?.['data-bg'];
        const variant = p['data-variant'] || node?.properties?.['data-variant'];
        const sizeNum = size != null ? Number(size) : 128;

        // Optional icon overlay
        const iconName = p['data-icon-name'] || node?.properties?.['data-icon-name'] || node?.properties?.['dataIconName'];
        const iconSize = p['data-icon-size'] ?? node?.properties?.['data-icon-size'] ?? node?.properties?.['dataIconSize'];
        const iconColor = p['data-icon-color'] || node?.properties?.['data-icon-color'] || node?.properties?.['dataIconColor'];

        let iconProp: IUicon | undefined;
        if (iconName) {
            iconProp = {
                icon: String(iconName),
                size: iconSize != null && iconSize !== 'undefined' ? Number(iconSize) : undefined,
                color: iconColor || undefined,
            };
        }

        return (
            <UiQr
                srcUrl={String(qrUrl)}
                size={sizeNum}
                color={color || '#000000'}
                background={bg || '#ffffff'}
                variant={(variant as any) || 'square'}
                icon={iconProp}
            />
        );
    }

    // ── Icon token ─────────────────────────────────────────────────────
    const name = p['data-uicon'] || node?.properties?.['data-uicon'] || node?.properties?.['dataUicon'];
    if (name) {
        const color = p['data-color'] || node?.properties?.['data-color'];
        const w = p['data-w'] ?? node?.properties?.['data-w'];
        const h = p['data-h'] ?? node?.properties?.['data-h'];
        const variant = p['data-variant'] || node?.properties?.['data-variant'];
        const wNum = w != null ? Number(w) : undefined;
        const hNum = h != null ? Number(h) : undefined;
        return (
            <UiIcon
                icon={String(name)}
                color={color || undefined}
                width={wNum}
                height={hNum}
                alt={variant || undefined}
            />
        );
    }

    // ── Default: pass-through ──────────────────────────────────────────
    return <span {...props} />;
};

export default SpanRenderer;
