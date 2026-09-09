/**
 * dimension-helpers.ts
 * Aspect ratio presets and dimension calculation utilities for Canopy overlays
 */

export type AspectPreset = {
    label: string;
    value: string;
    width: number;
    height: number;
    ratio?: number; // width/height for non-fullscreen presets
    isFullscreen?: boolean;
};

export const ASPECT_PRESETS: AspectPreset[] = [
    { label: '16:9 (1920×1080)', value: '16:9', width: 1920, height: 1080, ratio: 16 / 9 },
    { label: '16:9 (1280×720)', value: '16:9-720', width: 1280, height: 720, ratio: 16 / 9 },
    { label: '4:3 (1024×768)', value: '4:3', width: 1024, height: 768, ratio: 4 / 3 },
    { label: '1:1 (1080×1080)', value: '1:1', width: 1080, height: 1080, ratio: 1 },
    { label: '21:9 (2560×1080)', value: '21:9', width: 2560, height: 1080, ratio: 21 / 9 },
    { label: 'Fullscreen (1920×1080)', value: 'fullscreen', width: 1920, height: 1080, isFullscreen: true },
];

const SOFT_MAX_WIDTH = 1920;
const SOFT_MAX_HEIGHT = 1080;
const HARD_MAX_WIDTH = 3840;
const HARD_MAX_HEIGHT = 2160;

/**
 * Detect which preset matches the given dimensions
 */
export const detectCurrentPreset = (width: number, height: number): string | null => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }

    for (const preset of ASPECT_PRESETS) {
        if (preset.width === width && preset.height === height) {
            return preset.value;
        }
    }

    // Check if ratio matches any preset (allow for custom dimensions with standard ratios)
    const ratio = width / height;
    const tolerance = 0.01;

    for (const preset of ASPECT_PRESETS) {
        if (!preset.isFullscreen && preset.ratio && Math.abs(ratio - preset.ratio) < tolerance) {
            return preset.value;
        }
    }

    return null;
};

/**
 * Calculate dimensions from aspect preset
 * @param presetValue - The preset value (e.g., '16:9', 'fullscreen')
 * @param lockedDim - Optional: if 'width' or 'height', use that dimension and calculate the other
 * @param currentWidth - Current width value (used when lockedDim is 'width')
 * @param currentHeight - Current height value (used when lockedDim is 'height')
 */
export const calculateFromAspect = (
    presetValue: string,
    lockedDim?: 'width' | 'height',
    currentWidth?: number,
    currentHeight?: number
): { width: number; height: number } => {
    const preset = ASPECT_PRESETS.find((p) => p.value === presetValue);

    if (!preset) {
        return { width: currentWidth ?? 1920, height: currentHeight ?? 1080 };
    }

    // If it's fullscreen or no locked dimension, return preset defaults
    if (preset.isFullscreen || !lockedDim) {
        return { width: preset.width, height: preset.height };
    }

    // Calculate based on locked dimension
    if (lockedDim === 'width' && currentWidth && preset.ratio) {
        const width = Math.max(1, Math.round(currentWidth));
        const height = Math.max(1, Math.round(width / preset.ratio));
        return { width, height };
    }

    if (lockedDim === 'height' && currentHeight && preset.ratio) {
        const height = Math.max(1, Math.round(currentHeight));
        const width = Math.max(1, Math.round(height * preset.ratio));
        return { width, height };
    }

    return { width: preset.width, height: preset.height };
};

/**
 * Clamp dimensions to valid ranges and return warning/error status
 */
export const clampDimensions = (
    width: number,
    height: number
): {
    width: number;
    height: number;
    warning: boolean;
    error: boolean;
    message?: string;
} => {
    const w = Math.max(1, Math.min(HARD_MAX_WIDTH, Math.round(width)));
    const h = Math.max(1, Math.min(HARD_MAX_HEIGHT, Math.round(height)));

    const exceedsSoft = w > SOFT_MAX_WIDTH || h > SOFT_MAX_HEIGHT;
    const exceedsHard = width > HARD_MAX_WIDTH || height > HARD_MAX_HEIGHT;

    let message: string | undefined;
    if (exceedsHard) {
        message = `Dimensions clamped to maximum ${HARD_MAX_WIDTH}×${HARD_MAX_HEIGHT}`;
    } else if (exceedsSoft) {
        message = `⚠️ Dimensions above ${SOFT_MAX_WIDTH}×${SOFT_MAX_HEIGHT} may impact performance`;
    }

    return {
        width: w,
        height: h,
        warning: exceedsSoft && !exceedsHard,
        error: exceedsHard,
        message,
    };
};

/**
 * Get a human-readable aspect ratio label from dimensions
 */
export const computeAspectLabel = (width: number, height: number): string => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return 'Custom';
    }

    const ratio = width / height;
    const tolerance = 0.01;

    if (Math.abs(ratio - 16 / 9) < tolerance) return '16:9';
    if (Math.abs(ratio - 4 / 3) < tolerance) return '4:3';
    if (Math.abs(ratio - 1) < tolerance) return '1:1';
    if (Math.abs(ratio - 21 / 9) < tolerance) return '21:9';

    return `${width}:${height}`;
};

/**
 * Get preset by value
 */
export const getPresetByValue = (value: string): AspectPreset | undefined => {
    return ASPECT_PRESETS.find((p) => p.value === value);
};
