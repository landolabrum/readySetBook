// Relative Path: ./UiIconPicker.tsx
import React, { useEffect, useMemo, useState } from 'react';
import styles from './UiIconPicker.scss';
import AdaptGrid from '@webstack/components/Containers/AdaptGrid/AdaptGrid';
import IconHelper from '@webstack/helpers/IconHelper';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import type { IFormField } from '@webstack/components/UiForm/models/IFormModel';

export type UiIconPickerProps = {
  onSelect?: (token: string) => void;
  selected?: string;
  filter?: string;
  defaultColor?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultVariant?: string;
};

const UiIconPicker: React.FC<UiIconPickerProps> = ({
  onSelect,
  selected,
  filter,
  defaultColor = '',
  defaultWidth,
  defaultHeight,
  defaultVariant = '',
}) => {
  const [search, setSearch] = useState<string>(filter ?? '');
  useEffect(() => { setSearch(filter ?? ''); }, [filter]);
  const names = useMemo(() => IconHelper.listIconNames(search || filter || ''), [filter, search]);
  const [color, setColor] = useState<string>(defaultColor);
  const [w, setW] = useState<number | undefined>(defaultWidth);
  const [h, setH] = useState<number | undefined>(defaultHeight);
  const [variant, setVariant] = useState<string>(defaultVariant);

  const iconFields: IFormField[] = [
    { name: 'color', label: 'Color', type: 'text', value: color, placeholder: '#RRGGBB or name' },
    { name: 'w', label: 'Width', type: 'number', value: w ?? '', min: 0, step: 1, width: '50%' },
    { name: 'h', label: 'Height', type: 'number', value: h ?? '', min: 0, step: 1, width: '50%' },
    {
      name: 'variant', label: 'Variant', type: 'select', options: [
        { label: 'Ghost', value: 'ghost' },
        { label: 'Flat', value: 'flat' },
        { label: 'Dark', value: 'dark' },
      ], value: variant, placeholder: 'optional',
    },
  ];

  const onFormChange = (e: any) => {
    const { name, value } = e?.target || {};
    const resolved = typeof value === 'object' && value !== null ? value.value : value;
    if (name === 'color') setColor(String(resolved ?? ''));
    if (name === 'w') setW(resolved === '' || resolved == null ? undefined : Number(resolved));
    if (name === 'h') setH(resolved === '' || resolved == null ? undefined : Number(resolved));
    if (name === 'variant') setVariant(String(resolved ?? ''));
  };

  const buildToken = (name: string) => {
    const colorPart = color ? `"${color}"` : 'undefined';
    const sizePart = `[${w ?? ''}${w != null || h != null ? ', ' : ''}${h ?? ''}]`;
    const variantPart = variant ? `"${variant}"` : 'undefined';
    return `::icon(name:"${name}", color:${colorPart}, size:${sizePart}, variant:${variantPart})`;
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className='ui-icon-picker'>
        <div className='ui-icon-picker__properties'>
          <div className='icon-picker__search'>
            <UiInput
              type='text'
              value={search}
              placeholder='Search icons…'
              onChange={(e) => setSearch(e.target.value)}
              traits={{
                afterIcon: {
                  icon: search ? 'fa-xmark' : 'fa-magnifying-glass',
                  onClick: () => setSearch(''),
                },
              }}
            />
          </div>
          <UiForm fields={iconFields} onChange={onFormChange} />
        </div>

        <AdaptGrid xs={5} md={10} gap={3}>
          {names.map((name) => (
            <div
              key={name}
              className={`icon-item${selected === name ? ' is-active' : ''}`}
              onClick={() => onSelect?.(buildToken(name))}
            >
              <UiIcon icon={name} alt={name} color={color || undefined} size={w || undefined} />
            </div>
          ))}
        </AdaptGrid>
      </div>
    </>
  );
};

export default UiIconPicker;
