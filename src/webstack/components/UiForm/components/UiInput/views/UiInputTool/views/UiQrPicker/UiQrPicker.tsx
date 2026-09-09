// Relative Path: ./UiQrPicker.tsx
import React, { useState } from 'react';
import styles from './UiQrPicker.scss';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiQr from '@webstack/components/UiQr/controller/UiQr';
import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import type { IUicon } from '@webstack/components/UiIcon/controller/UiIcon';

export type UiQrPickerProps = {
  onSelect?: (token: string) => void;
  defaultColor?: string;
  defaultSize?: number;
  defaultBackground?: string;
  defaultVariant?: string;
};

const UiQrPicker: React.FC<UiQrPickerProps> = ({
  onSelect,
  defaultColor = '#000000',
  defaultSize = 128,
  defaultBackground = '#ffffff',
  defaultVariant = 'square',
}) => {
  const [srcUrl, setSrcUrl] = useState<string>('');
  const [color, setColor] = useState<string>(defaultColor);
  const [size, setSize] = useState<number>(defaultSize);
  const [background, setBackground] = useState<string>(defaultBackground);
  const [variant, setVariant] = useState<string>(defaultVariant);

  // Optional icon overlay state
  const [iconName, setIconName] = useState<string>('');
  const [iconSize, setIconSize] = useState<number | undefined>(undefined);
  const [iconColor, setIconColor] = useState<string>('');

  const qrFields: IFormField[] = [
    { name: 'srcUrl', label: 'URL / Data', type: 'text', value: srcUrl, placeholder: 'https://example.com', required: true },
    { name: 'size', label: 'Size', type: 'number', value: size, min: 32, max: 512, step: 8 },
    { name: 'color', label: 'Color', type: 'text', value: color, placeholder: '#000000' },
    { name: 'background', label: 'Background', type: 'text', value: background, placeholder: '#ffffff' },
    {
      name: 'variant', label: 'Variant', type: 'select', options: [
        { label: 'Square', value: 'square' },
        { label: 'Rounded', value: 'rounded' },
        { label: 'Dots', value: 'dots' },
      ], value: variant, placeholder: 'square',
    },
    { name: 'iconName', label: 'Icon', type: 'text', value: iconName, placeholder: 'e.g. fa-star (optional)' },
    { name: 'iconSize', label: 'Icon Size', type: 'number', value: iconSize ?? '', min: 8, max: 128, step: 1, width: '50%' },
    { name: 'iconColor', label: 'Icon Color', type: 'text', value: iconColor, placeholder: '#333333', width: '50%' },
  ];

  const onFormChange = (e: any) => {
    const { name, value } = e?.target || {};
    const resolved = typeof value === 'object' && value !== null ? value.value : value;
    if (name === 'srcUrl') setSrcUrl(String(resolved ?? ''));
    if (name === 'size') setSize(resolved === '' || resolved == null ? 128 : Number(resolved));
    if (name === 'color') setColor(String(resolved ?? '#000000'));
    if (name === 'background') setBackground(String(resolved ?? '#ffffff'));
    if (name === 'variant') setVariant(String(resolved ?? 'square'));
    if (name === 'iconName') setIconName(String(resolved ?? ''));
    if (name === 'iconSize') setIconSize(resolved === '' || resolved == null ? undefined : Number(resolved));
    if (name === 'iconColor') setIconColor(String(resolved ?? ''));
  };

  const iconProps: IUicon | undefined = iconName.trim()
    ? { icon: iconName.trim(), size: iconSize, color: iconColor || undefined }
    : undefined;

  const buildQrToken = () => {
    if (!srcUrl.trim()) return '';
    const sizePart = String(size);
    const colorPart = color ? `"${color}"` : '"#000000"';
    const bgPart = background ? `"${background}"` : '"#ffffff"';
    const variantPart = variant ? `"${variant}"` : '"square"';
    let token = `::qr(srcUrl:"${srcUrl}", size:${sizePart}, color:${colorPart}, background:${bgPart}, variant:${variantPart}`;
    if (iconName.trim()) {
      const iSize = iconSize != null ? String(iconSize) : 'undefined';
      const iColor = iconColor ? `"${iconColor}"` : 'undefined';
      token += `, icon:{name:"${iconName.trim()}", size:${iSize}, color:${iColor}}`;
    }
    token += ')';
    return token;
  };

  const handleInsert = () => {
    const token = buildQrToken();
    if (token && onSelect) onSelect(token);
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className='ui-qr-picker'>
        <UiForm fields={qrFields} onChange={onFormChange} />
        <div className='ui-qr-picker__preview'>
          {srcUrl.trim() ? (
            <>
              <UiQr
                srcUrl={srcUrl}
                size={Math.min(size, 160)}
                color={color}
                background={background}
                variant={(variant as any) || 'square'}
                icon={iconProps}
              />
              <button
                type='button'
                className='ui-qr-picker__insert'
                onClick={handleInsert}
              >
                Insert QR Code
              </button>
            </>
          ) : (
            <div className='ui-qr-picker__placeholder'>
              Enter a URL above to preview
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UiQrPicker;