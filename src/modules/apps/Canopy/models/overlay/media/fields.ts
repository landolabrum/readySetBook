import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { CanonOverlay } from '../types';
import type { MediaSegment } from './types';
import { _s, _n } from '../coerce';

export const multiviewFields = (data: any): IFormField[] => [
  {
    name: 'data.multiviewColumns', label: 'Grid Columns', type: 'select',
    value: String(typeof data?.multiviewColumns === 'number' ? data.multiviewColumns : 0),
    options: [
      { label: 'Auto', value: '0' }, { label: '1', value: '1' },
      { label: '2', value: '2' },    { label: '3', value: '3' },
      { label: '4', value: '4' },
    ],
    width: '33%',
  },
  {
    name: 'data.multiviewObjectFit', label: 'Object Fit', type: 'select',
    value: data?.multiviewObjectFit ?? 'contain',
    options: [
      { label: 'Contain', value: 'contain' },
      { label: 'Cover',   value: 'cover' },
      { label: 'Fill',    value: 'fill' },
    ],
    width: '33%',
  },
  { name: 'data.multiviewShowLabels', label: 'Show Labels', type: 'checkbox', value: typeof data?.multiviewShowLabels === 'boolean' ? data.multiviewShowLabels : false, width: '33%' },
];

export const mediaSegmentFields = (seg: MediaSegment, index: number): IFormField[] => {
  const pfx  = `data.segments.${index}`;
  const kind = String(seg.kind || 'video');
  return [
    { name: `${pfx}.url`,     label: 'URL',            type: 'text',    value: _s(seg.url), width: '100%', placeholder: 'https://...' },
    {
      name: `${pfx}.kind`, label: 'Type', type: 'select', width: '33%',
      value: kind === 'iframe' ? 'iframe' : kind === 'image' ? 'image' : 'video',
      options: [{ label: 'Video', value: 'video' }, { label: 'Image', value: 'image' }, { label: 'iFrame', value: 'iframe' }],
    },
    { name: `${pfx}.duration`, label: 'Duration (s)',    type: 'number', value: _n(seg.duration ?? 30, 30), min: 1,  step: 1, width: '33%' },
    { name: `${pfx}.preload`,  label: 'Preload (s)',     type: 'number', value: _n(seg.preload  ?? 0,  0),  min: 0,  step: 1, width: '33%' },
    { name: `${pfx}.width`,    label: 'Width (px)',      type: 'number', value: _n(seg.width    ?? 1920, 1920), min: 1, max: 3840, step: 1, width: '50%' },
    { name: `${pfx}.height`,   label: 'Height (px)',     type: 'number', value: _n(seg.height   ?? 1080, 1080), min: 1, max: 2160, step: 1, width: '50%' },
    { name: `${pfx}.poster`,   label: 'Poster URL',      type: 'text',   value: _s(seg.poster   ?? ''), width: '100%' },
    { name: `${pfx}.autoplay`, label: 'Autoplay',        type: 'checkbox', value: seg.autoplay !== false, width: '25%' },
    { name: `${pfx}.loop`,     label: 'Loop',            type: 'checkbox', value: Boolean(seg.loop),      width: '25%' },
    { name: `${pfx}.muted`,    label: 'Muted',           type: 'checkbox', value: Boolean(seg.muted),     width: '25%' },
    { name: `${pfx}.playing`,  label: 'Start Playing',   type: 'checkbox', value: seg.playing !== false,  width: '25%' },
    { name: `${pfx}.volume`,   label: 'Volume (0-1)',     type: 'number', value: Math.max(0, Math.min(1, _n(seg.volume ?? 1, 1))), min: 0, max: 1, step: 0.1, width: '50%' },
  ];
};

export const overlayMediaFields = (ov: CanonOverlay): IFormField[] => {
  const data = (ov?.data ?? {}) as any;
  const kind = String(data?.kind || 'video');

  const base: IFormField[] = [
    {
      name: 'data.kind', label: 'Default Media Type', type: 'select', width: '33%',
      value: kind === 'iframe' ? 'iframe' : kind === 'image' ? 'image' : 'video',
      options: [{ label: 'Video', value: 'video' }, { label: 'Image Stream', value: 'image' }, { label: 'iFrame', value: 'iframe' }],
    },
    { name: 'data.rtspFps',        label: 'Stream FPS',        type: 'number', value: data?.rtspFps        ?? 12,   min: 1,  max: 30,  step: 1, width: '33%', placeholder: '12' },
    { name: 'data.rtspQuality',    label: 'JPEG Quality',      type: 'number', value: data?.rtspQuality    ?? 85,   min: 10, max: 100, step: 5, width: '33%', placeholder: '85' },
    {
      name: 'data.rtspResolution', label: 'Stream Resolution', type: 'select', value: data?.rtspResolution ?? '', width: '33%',
      options: [
        { label: 'Original', value: '' }, { label: '1920×1080', value: '1920x1080' },
        { label: '1280×720', value: '1280x720' }, { label: '854×480', value: '854x480' },
        { label: '640×360', value: '640x360' }, { label: '426×240', value: '426x240' },
      ],
    },
    { name: 'data.autoplay', label: 'Default Autoplay',  type: 'checkbox', value: data?.autoplay !== false,   width: '25%' },
    { name: 'data.loop',     label: 'Default Loop',      type: 'checkbox', value: Boolean(data?.loop),        width: '25%' },
    { name: 'data.muted',    label: 'Default Muted',     type: 'checkbox', value: Boolean(data?.muted),       width: '25%' },
    { name: 'data.playing',  label: 'Default Playing',   type: 'checkbox', value: data?.playing !== false,    width: '25%' },
    { name: 'data.volume',   label: 'Default Volume',    type: 'number',   value: typeof data?.volume === 'number' ? data.volume : 1, min: 0, max: 1, step: 0.1, width: '50%' },
    { name: 'data.poster',   label: 'Default Poster URL', type: 'text',    value: data?.poster ?? '', placeholder: 'https://...', width: '50%' },
  ];

  if (_s(ov.variant ?? 'default') === 'multiview') {
    base.push(...multiviewFields(data));
  }

  return base;
};
