import { createField } from '@webstack/components/UiForm/functions/formFieldFunctions';
import { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import { IUserStream } from '~/src/core/services/MemberService/IMemberService';
import { streamProviderSettings } from './streamProviderTypes';

interface BuildFieldArgs {
    selectedProvider: string;
    current?: any;
    userStreams: Record<string, IUserStream>;
    devices?: any[];
    selectedStreamEnabled?: boolean;
    selectedStream?: IUserStream | null;
}

export interface StreamFieldsResult {
    basicFields: IFormField[];
    advancedFields: IFormField[];
    allFields: IFormField[];
}

// Provider-specific userHandle labels
const USER_HANDLE_LABELS: Record<string, string> = {
    twitch: 'Twitch Username',
    youtube: 'YouTube Channel/Handle',
    facebook: 'Facebook Page/User',
    custom: 'Source URL (streamlink-compatible)',
};

/**
 * Generate a composite stream key for multi-stream support.
 * Format: PROVIDER-streamKey (first 12 chars) or PROVIDER-new
 */
export const getStreamCompositeKey = (stream: IUserStream): string => {
    const provider = (stream.provider || 'custom').toUpperCase();
    const keyPart = stream.streamKey?.slice(0, 12) || stream.id?.slice(0, 8) || 'new';
    return `${provider}-${keyPart}`;
};

/**
 * Find a user config by provider from a map keyed by composite key or stream id.
 */
const findUserConfigByProvider = (
    userStreams: Record<string, IUserStream>,
    provider: string,
): IUserStream | undefined => {
    // First try direct provider match (legacy)
    if (userStreams[provider]) return userStreams[provider];
    // Then search by provider field in values
    return Object.values(userStreams).find((s) => s.provider === provider);
};

export const buildStreamFields = ({
    selectedProvider,
    current,
    userStreams,
    devices = [],
    selectedStreamEnabled = false,
    selectedStream = null,
}: BuildFieldArgs): StreamFieldsResult => {
    const cfg =
        streamProviderSettings[
        selectedProvider as keyof typeof streamProviderSettings
        ] || streamProviderSettings.custom;
    const userCfg = selectedStream || findUserConfigByProvider(userStreams, selectedProvider);

    const mergedNetwork = {
        destinationUrl:
            userCfg?.network?.destinationUrl || cfg.network.destinationUrl || '',
        protocol: userCfg?.network?.protocol || userCfg?.protocol || cfg.network.protocol || '',
    };

    // Each stream uses its own saved video dimensions; fall back to
    // provider defaults only — never inject the *current* event's
    // design_width / design_height so that switching events or toggling
    // live doesn't overwrite another stream's resolution.
    const mergedVideo = {
        width: userCfg?.video?.width || cfg.video.width,
        height: userCfg?.video?.height || cfg.video.height,
        colorDepth: userCfg?.video?.colorDepth || cfg.video.colorDepth,
        framerate: userCfg?.video?.framerate || cfg.video.framerate,
        bitrate: userCfg?.video?.bitrate || cfg.video.bitrate,
    };

    const mergedAudio = {
        bitrate: userCfg?.audio?.bitrate || cfg.audio.bitrate,
        channels: userCfg?.audio?.channels || cfg.audio.channels,
        samplerate: userCfg?.audio?.samplerate || cfg.audio.samplerate,
        inputFormat: userCfg?.audio?.inputFormat || cfg.audio.inputFormat,
        inputDevice: userCfg?.audio?.inputDevice || cfg.audio.inputDevice,
    };

    // Build provider-specific userHandle field
    const handleLabel = USER_HANDLE_LABELS[selectedProvider] || USER_HANDLE_LABELS.custom;
    const isCustomProvider = selectedProvider === 'custom';

    // Basic fields: userHandle/websiteUrl, streamKey, serverUrl, protocol
    const basicFields: IFormField[] = [
        isCustomProvider
            ? createField({
                name: 'websiteUrl',
                label: handleLabel,
                value: userCfg?.websiteUrl || current?.websiteUrl || '',
                placeholder: 'https://twitch.tv/example or other streamlink URL',
            })
            : createField({
                name: 'userHandle',
                label: handleLabel,
                value: userCfg?.userHandle || current?.userHandle || '',
                placeholder: selectedProvider === 'twitch' ? `Your ${selectedProvider} username` : selectedProvider === 'youtube' ? '@channelname' : 'pagename',
            }),
        createField({
            name: 'streamKey',
            value: userCfg?.streamKey || current?.streamKey || '',
        }),
        createField({
            name: 'serverUrl',
            label: 'Server URL',
            value: mergedNetwork.destinationUrl,
        }),
        createField({ name: 'protocol', value: mergedNetwork.protocol }),
    ].filter(Boolean) as IFormField[];

    // Advanced fields: video and audio settings, plus device selector
    const advancedFields: IFormField[] = [
        createField({ name: 'videoWidth', label: 'Video Width', value: mergedVideo.width }),
        createField({ name: 'videoHeight', type: 'number', label: 'Video Height', value: mergedVideo.height }),
        createField({ name: 'colorDepth', type: 'number', value: mergedVideo.colorDepth }),
        createField({ name: 'framerate', type: 'number', value: mergedVideo.framerate }),
        createField({ name: 'bitrate',type:'number', value: mergedVideo.bitrate }),
        createField({ name: 'audioBitrate', type: 'number', label: 'Audio Bitrate', value: mergedAudio.bitrate }),
        createField({ name: 'audioChannels', type: 'number', label: 'Audio Channels', value: mergedAudio.channels }),
        createField({ name: 'audioSamplerate', type: 'number', label: 'Audio Samplerate', value: mergedAudio.samplerate }),
        createField({ name: 'audioInputFormat', label: 'Audio Input Format', value: mergedAudio.inputFormat }),
        createField({ name: 'audioInputDevice', label: 'Audio Input Device', value: mergedAudio.inputDevice }),
    ].filter(Boolean) as IFormField[];

    // Always expose device selection in the primary section so it isn't hidden behind advanced settings.
    {
        // Normalize savedValue: if a stream was previously saved with the raw
        // device id of the main host (e.g. "mb1-orch-1"), map it to the sentinel.
        const rawSelected = userCfg?.selectedDeviceId || 'auto';
        const mainDevice = devices.find((d: any) => d.role === 'main');
        const selectedValue =
            mainDevice && rawSelected === mainDevice.id ? 'main-host' : rawSelected;

        const rankedDevices = [...devices]
            .sort((a: any, b: any) => {
                // Keep online devices first, but still show offline devices as disabled.
                const aOnline = a.status === 'online';
                const bOnline = b.status === 'online';
                if (aOnline !== bOnline) return aOnline ? -1 : 1;

                // Most available memory first when available.
                const aAvail = typeof a.availableMemoryMB === 'number' ? a.availableMemoryMB : -1;
                const bAvail = typeof b.availableMemoryMB === 'number' ? b.availableMemoryMB : -1;
                if (aAvail !== bAvail) return bAvail - aAvail;

                // Then lower memory usage first.
                const aMemory = typeof a.memoryUsagePercent === 'number' ? a.memoryUsagePercent : 101;
                const bMemory = typeof b.memoryUsagePercent === 'number' ? b.memoryUsagePercent : 101;
                return aMemory - bMemory;
            })
            .map((device: any) => {
                // Main-role devices must use the backend sentinel "main-host" so the
                // stream worker routes them to local execution instead of erroring.
                const value = device.role === 'main' ? 'main-host' : device.id;
                const isOnline = device.status === 'online';
                const memLabel = typeof device.memoryUsagePercent === 'number'
                    ? `, mem ${device.memoryUsagePercent}%`
                    : '';
                const statusLabel = isOnline ? 'online' : `offline`;
                return {
                    label: `${device.displayName} (${statusLabel}${memLabel})`,
                    value,
                    disabled: !isOnline && value !== selectedValue,
                };
            });

        const defaultLabel = selectedStreamEnabled
            ? 'Auto (least memory usage now)'
            : 'Auto (least memory usage when enabled)';

        const options = [{
            label: defaultLabel,
            value: null,
            // value: 'auto',
        }, ...rankedDevices];

        const selectedDeviceField = createField({
            name: 'selectedDeviceId',
            label: 'Stream Device (Load Balancer)',
            type: 'select',
            value: selectedValue,
            options,
        });

        if (selectedDeviceField) {
            basicFields.push(selectedDeviceField);
        }
    }

    return {
        basicFields,
        advancedFields,
        allFields: [...basicFields, ...advancedFields],
    };
};
