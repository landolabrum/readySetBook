import { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import {
    IUserStream,
    IUserStreamPayload,
} from '~/src/core/services/MemberService/IMemberService';

export const extractValue = (raw: any) => {
    if (raw && typeof raw === 'object') {
        if ('value' in raw) return (raw as any).value;
        if ('target' in raw) return (raw as any).target?.value;
    }
    return raw;
};

export const getFieldValue = (fields: IFormField[], name: string) => {
    return fields.find((f) => f.name === name)?.value;
};

const toNumber = (val: any) => {
    if (val === '' || val === null || val === undefined) return undefined;

    // Normalize any stray characters (e.g., pasted "1080p" or "1,260") before coercing.
    const cleaned = typeof val === 'number'
        ? val
        : (() => {
            const asString = String(val);
            const groups = asString.match(/\d+/g);
            if (groups && groups.length > 1) {
                // Preserve all digits when users type separators (e.g., 1.260 or 1,260 → 1260).
                return Number(groups.join(''));
            }
            const match = asString.match(/-?\d+(?:\.\d+)?/);
            return match ? Number(match[0]) : NaN;
        })();

    if (!Number.isFinite(cleaned)) return undefined;
    return cleaned;
};

const toInt = (val: any) => {
    const num = toNumber(val);
    return Number.isFinite(num) ? Math.round(num as number) : undefined;
};

const toStringOrUndefined = (val: any) => {
    if (val === '' || val === null || val === undefined) return undefined;
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map((v) => v ?? '').join(',');
    return undefined;
};

const pickDefined = (obj: Record<string, any>) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
};

export const buildPayloadFromFields = (
    fields: IFormField[],
    providerFallback: string,
    eventId: string,
    userId?: string,
): IUserStreamPayload => {
    const providerValue = String(
        getFieldValue(fields, 'provider') ?? providerFallback ?? 'custom',
    ).toLowerCase();

    const streamKey = toStringOrUndefined(getFieldValue(fields, 'streamKey'));
    const serverUrl = toStringOrUndefined(getFieldValue(fields, 'serverUrl'));
    const protocolValue = toStringOrUndefined(getFieldValue(fields, 'protocol'));

    const video = pickDefined({
        width: toInt(getFieldValue(fields, 'videoWidth')),
        height: toInt(getFieldValue(fields, 'videoHeight')),
        colorDepth: toInt(getFieldValue(fields, 'colorDepth')),
        framerate: toInt(getFieldValue(fields, 'framerate')),
        bitrate: toInt(getFieldValue(fields, 'bitrate')),
    });

    const audio = pickDefined({
        bitrate: toInt(getFieldValue(fields, 'audioBitrate')),
        channels: toInt(getFieldValue(fields, 'audioChannels')),
        samplerate: toInt(getFieldValue(fields, 'audioSamplerate')),
        inputFormat: getFieldValue(fields, 'audioInputFormat') || undefined,
        inputDevice: getFieldValue(fields, 'audioInputDevice') || undefined,
    });

    const network = pickDefined({
        destinationUrl: serverUrl || undefined,
        protocol: protocolValue || undefined,
    });

    // Handle userHandle for non-custom providers, websiteUrl for custom
    const userHandle = toStringOrUndefined(getFieldValue(fields, 'userHandle'));
    const websiteUrl = toStringOrUndefined(getFieldValue(fields, 'websiteUrl'));
    const selectedDeviceId = toStringOrUndefined(getFieldValue(fields, 'selectedDeviceId'));

    return {
        provider: providerValue,
        eventId,
        userId,
        streamKey,
        serverUrl,
        protocol: protocolValue,
        userHandle,
        websiteUrl,
        video: Object.keys(video).length ? video : undefined,
        audio: Object.keys(audio).length ? audio : undefined,
        network: Object.keys(network).length ? network : undefined,
        selectedDeviceId,
    };
};

export const buildPayloadFromStream = (
    stream: IUserStream,
    overrides?: Partial<IUserStreamPayload>,
): IUserStreamPayload => {
    return {
        id: stream.id, // Include ID for updates (multi-stream support)
        provider: stream.provider,
        eventId: stream.eventId, // Primary key
        userId: stream.userId,
        streamKey: stream.streamKey || undefined,
        serverUrl: stream.serverUrl || undefined,
        protocol: stream.protocol || undefined,
        websiteUrl: stream.websiteUrl || undefined,
        rtmpUrl: stream.rtmpUrl || undefined,
        enabled: stream.enabled,
        containerName: stream.containerName || undefined,
        userHandle: stream.userHandle || undefined,
        video: stream.video,
        audio: stream.audio,
        network: stream.network,
        selectedDeviceId: (stream as any).selectedDeviceId || undefined,
        ...(overrides || {}),
    };
};
