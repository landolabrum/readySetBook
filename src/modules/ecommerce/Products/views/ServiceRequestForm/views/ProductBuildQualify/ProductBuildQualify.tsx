// Relative Path: ./ProductBuildUsageView.tsx
import React, { useMemo, useState } from 'react';
import styles from './ProductBuildQualify.scss';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import UiPill from '@webstack/components/UiForm/components/UiPill/UiPill';


// Remember to create a sibling SCSS file with the same name as this component
interface IProdBuildQuality {
  options: object[];
  onSelect: (e: any) => void;
  onQuantity?: (name: string, value: any, quantity: number) => void;
  label?: string;
}
const ProductBuildQualify: React.FC<any> = ({ options, onSelect, onQuantity, label }: IProdBuildQuality) => {
  const [searchTerm, setSearchTerm] = useState('');
  const optLabel = (o:any)=> o?.label || o?.name;
  const filteredOptions = useMemo(() => {
    if (!Array.isArray(options) || !options.length) return options || [];
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((opt: any) => {
      const hay = `${opt?.label || opt?.name || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [options, searchTerm]);

  return (
    <>
      <style jsx>{styles}</style>

      <div className='product-build-qualify'>
        <div className='product-build-qualify__search'>
          <UiInput
            type='text'
            placeholder='Search appliances...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e?.target?.value || '')}
            traits={{
              beforeIcon: 'fa-magnifying-glass',
              afterIcon: searchTerm
                ? {
                  icon: 'fa-xmark',
                  onClick: () => setSearchTerm(''),
                }
                : undefined,
            }}
          />
        </div>
        {!filteredOptions?.length && searchTerm ? (
          <div className='product-build-qualify__empty'>No matches found.</div>
        ) : null}
        <div className='product-build-qualify__appliances'>
          {(filteredOptions || []).map((opt: any) =>
            opt?.checked ? (
              <div key={opt?.name} className='product-build-qualify__appliance product-build-qualify__appliance--selected'>
                {/* {opt?.label || opt?.name} */}
                <span className='product-build-qualify__appliance--label'>
                  {optLabel(opt)}
                </span>
                <UiPill
                  traits={{size:"xs"}}
                  variant="flat"
                  // label={optLabel(opt)}
                  name={opt?.name}
                  amount={Number(opt?.quantity) > 0 ? Number(opt.quantity) : 1}
                  min={0}
                  increment={1}
                  showTrashAtMinPlusStep
                  setAmount={(qty: number) => onQuantity?.(opt?.name, opt?.value, qty)}
                />
              </div>
            ) : (
              <UiButton
                key={opt?.name}
                name={opt?.name}
                value={opt?.value}
                size="sm"
                // variant='flat'
                onClick={() =>
                  onSelect?.({ target: { name: opt?.name, value: opt?.value, checked: true, type: 'checkbox' } })
                }
              >
                  {optLabel(opt)}
              </UiButton>
            ),
          )}
        </div>
      </div>

    </>
  );
};

export default ProductBuildQualify;
