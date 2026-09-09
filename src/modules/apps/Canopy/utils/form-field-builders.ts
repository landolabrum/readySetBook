/**
 * form-field-builders.ts
 * Reusable form field builders for Canopy overlay controls
 */

import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import { ASPECT_PRESETS } from './dimension-helpers';

const _n = (v: unknown, d = 0): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
};

const _bool = (v: unknown): boolean => {
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    if (typeof v === 'string') {
        const t = v.trim().toLowerCase();
        if (['true', '1', 'yes', 'on', 'y'].includes(t)) return true;
        if (['false', '0', 'no', 'off', 'n', ''].includes(t)) return false;
    }
    return false;
};

/**
 * Build dimension-related fields (aspect preset, width, height)
 * Used by both media and device overlays
 */
export const buildDimensionFields = (data: any): IFormField[] => {
    const width = _n(data?.width ?? 1920, 1920);
    const height = _n(data?.height ?? 1080, 1080);
    const aspectPreset = data?.aspectPreset ?? '16:9';

    const presetOptions = ASPECT_PRESETS.map((preset) => ({
        label: preset.label,
        value: preset.value,
    }));

    return [
        {
            name: 'data.aspectPreset',
            label: 'Aspect Preset',
            type: 'select',
            value: aspectPreset,
            options: presetOptions,
            width: '100%',
        },
        {
            name: 'data.width',
            label: 'Width (px)',
            type: 'number',
            value: width,
            min: 1,
            max: 3840,
            step: 1,
            width: '50%',
        },
        {
            name: 'data.height',
            label: 'Height (px)',
            type: 'number',
            value: height,
            min: 1,
            max: 2160,
            step: 1,
            width: '50%',
        },
    ];
};

/**
 * Build video playback control fields (autoplay, loop, muted, playing, volume)
 * Shared by media and device overlays
 */
export const buildVideoFields = (data: any): IFormField[] => {
    const volume = _n(data?.volume ?? 1, 1);
    const clampedVolume = Math.max(0, Math.min(1, volume));

    return [
        {
            name: 'data.autoplay',
            label: 'Autoplay',
            type: 'checkbox',
            value: _bool(data?.autoplay ?? true),
            width: '25%',
        },
        {
            name: 'data.loop',
            label: 'Loop',
            type: 'checkbox',
            value: _bool(data?.loop ?? false),
            width: '25%',
        },
        {
            name: 'data.muted',
            label: 'Muted',
            type: 'checkbox',
            value: _bool(data?.muted ?? false),
            width: '25%',
        },
        {
            name: 'data.playing',
            label: 'Start Playing',
            type: 'checkbox',
            value: _bool(data?.playing ?? true),
            width: '25%',
        },
        {
            name: 'data.volume',
            label: 'Volume (0-1)',
            type: 'number',
            value: clampedVolume,
            min: 0,
            max: 1,
            step: 0.1,
            width: '50%',
        },
    ];
};
