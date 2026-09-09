import { CanonOverlay } from './canopyOverlayTypes';

export const debugOverlayState = (overlays: CanonOverlay[] | null | undefined, context: string) => {
    const arr = Array.isArray(overlays) ? overlays : [];
    console.group(`[OverlayDebug] ${context}`);
    console.log(`Total overlays: ${arr.length}`);

    const byType = new Map<string, CanonOverlay[]>();
    for (const overlay of arr) {
        const type = overlay?.type?.toLowerCase() || 'unknown';
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type)!.push(overlay);
    }

    for (const [type, typeOverlays] of byType.entries()) {
        console.group(`${type} (${typeOverlays.length})`);
        for (const overlay of typeOverlays) {
            const enabled = overlay.enabled;
            console.log(`  🎯 ID: ${overlay.id}, Enabled: ${enabled}, Title: "${overlay.title}"`);
        }
        console.groupEnd();
    }

    console.groupEnd();
};

export const traceOverlayPipeline = (overlay: CanonOverlay, stage: string) => {
    console.log(`[OverlayTrace] ${stage}:`, {
        id: overlay.id,
        type: overlay.type,
        enabled: overlay.enabled,
        title: overlay.title
    });
};