// Relative Path: ./mediaNodeFields.ts
import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';

/**
 * Generates IFormField[] for a single video-URL node in the node editor.
 * Each node represents one entry in a media overlay's `data.urls` array
 * with per-URL settings (duration, dimensions, poster, playback flags).
 */
export function mediaNodeFields(url: string, _index: number): IFormField[] {
    const isHls = url.toLowerCase().includes('.m3u8');
    const isYouTube = (() => {
        try {
            const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
            return host === 'youtu.be' || host.endsWith('youtube.com');
        } catch {
            return false;
        }
    })();
    const defaultKind = isYouTube ? 'iframe' : 'video';

    return [
        {
            name: 'url',
            label: 'URL',
            type: 'text',
            value: url,
            readonly: true,
            width: '100%',
        },
        {
            name: 'kind',
            label: 'Type',
            type: 'select',
            value: defaultKind,
            options: [
                { label: 'Video', value: 'video' },
                { label: 'Image', value: 'image' },
                { label: 'iFrame', value: 'iframe' },
            ],
            width: '100%',
        },
        {
            name: 'duration',
            label: 'Duration (s)',
            type: 'number',
            value: 30,
            min: 1,
            step: 1,
            width: '50%',
        },
        {
            name: 'width',
            label: 'Width',
            type: 'number',
            value: 1920,
            min: 1,
            width: '50%',
        },
        {
            name: 'height',
            label: 'Height',
            type: 'number',
            value: 1080,
            min: 1,
            width: '50%',
        },
        {
            name: 'poster',
            label: 'Poster URL',
            type: 'text',
            value: '',
            width: '100%',
            placeholder: 'https://...',
        },
        {
            name: 'autoplay',
            label: 'Autoplay',
            type: 'checkbox',
            value: true,
            width: '33%',
        },
        {
            name: 'loop',
            label: 'Loop',
            type: 'checkbox',
            value: false,
            width: '33%',
        },
        {
            name: 'muted',
            label: 'Muted',
            type: 'checkbox',
            value: false,
            width: '33%',
        },
    ];
}
