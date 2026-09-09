import React, { useState, useRef } from 'react';
import styles from './UiMultiSelect.scss';
import UiInput from '../../UiInput/controller/UiInput';
import { IInput } from '@webstack/models/input';

import UiMultiSelectTags from '../views/UiMultiSelectTags';

interface IUiMultiSelect extends IInput {
  value: string[];
  onChange: (e: { target: { name: string; value: string[] } }) => void;
  allowDuplicates?: boolean;
  /** Which side touches the nav; opposite corners stay rounded */
  navSide?: "left" | "right" | "top" | "bottom";
}

const parseItems = (raw: string) =>
  raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const dedupeItems = (items: string[], seen: Set<string>) =>
  items.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });

const UiMultiSelect: React.FC<IUiMultiSelect> = (props) => {
  const [input, setInput] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [tagsVisible, setTagsVisible] = useState(true);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  const navSide = props.navSide ?? 'top';

  // Ensure value is always a valid array
  const valueArray = Array.isArray(props.value) ? props.value : [];

  // Use provided name or a safe default to avoid empty-name bugs
  const fieldName = props.name && props.name.length ? props.name : 'items';

  const emit = (next: string[]) =>
    props.onChange({ target: { name: fieldName, value: next } });

  /* ---------------- add or edit on Enter ---------------- */
  const handleKeyDown = (e?: React.KeyboardEvent<HTMLInputElement>) => {
    if (!e) return;
    const key = String(e.key).toLowerCase();
    if (key === 'enter') {
      e.preventDefault();
      const text = input.trim();
      const parsed = parseItems(text);
      if (editingIdx !== null) {
        // EDIT MODE
        const head = valueArray.slice(0, editingIdx);
        const tail = valueArray.slice(editingIdx + 1);

        if (!parsed.length) {
          // empty => delete this tag
          emit([...head, ...tail]);
        } else {
          const additions = props.allowDuplicates
            ? parsed
            : dedupeItems(parsed, new Set([...head, ...tail]));
          if (!additions.length) {
            // all values already exist elsewhere; ignore edit
            setEditingIdx(null);
            setInput('');
            return;
          }

          const next = [...head, ...additions, ...tail];
          emit(next);
        }
        setEditingIdx(null);
        setInput('');
        return;
      }

      // ADD MODE
      if (!parsed.length) return;
      const additions = props.allowDuplicates
        ? parsed
        : dedupeItems(parsed, new Set(valueArray));
      if (!additions.length) {
        setInput('');
        return;
      }
      emit([...valueArray, ...additions]);
      setInput('');
    } else if (key === 'escape') {
      e.preventDefault();
      setEditingIdx(null);
      setInput('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleRemove = (idxOrItem: number | string) => {
    // console.log('[UiMultiSelect] handleRemove called with:', idxOrItem, 'valueArray:', valueArray);
    let idx: number;
    if (typeof idxOrItem === 'number') {
      idx = idxOrItem;
    } else {
      // Find by exact string match
      idx = valueArray.findIndex(v => v === idxOrItem);
      // Fallback: try finding by index if it looks like a number
      if (idx < 0 && /^\d+$/.test(String(idxOrItem))) {
        idx = parseInt(String(idxOrItem), 10);
      }
    }
    console.log('[UiMultiSelect] resolved idx:', idx);
    if (idx < 0 || idx >= valueArray.length) {
      // console.log('[UiMultiSelect] idx out of bounds, returning');
      return;
    }
    const next = valueArray.filter((_, i) => i !== idx);
    // console.log('[UiMultiSelect] emitting next:', next, 'fieldName:', fieldName);
    emit(next);
    if (editingIdx === idx) {
      setEditingIdx(null);
      setInput('');
    } else if (editingIdx !== null && editingIdx > idx) {
      // Adjust editingIdx if we removed an item before it
      setEditingIdx(editingIdx - 1);
    }
  };

  const startEdit = (idx: number) => {
    if (props.readonly) return; // respect IInput readonly
    const tagValue = valueArray[idx] ?? '';
    setEditingIdx(idx);
    setInput(tagValue);
    // Focus the input after state updates
    setTimeout(() => {
      const inputEl = inputContainerRef.current?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 0);
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className={`ui-multi-select ${navSide ? ` ui-multi-select-${navSide}` : ''}`}>
        {/* Single input used for both adding and editing */}
        <div className="ui-multi-select__input--container" ref={inputContainerRef}>
          <UiInput
            label={editingIdx !== null ? props.label : `${valueArray.length ? `( ${valueArray.length} )` : "Click to add"} ${props.label || 'Add items'}`}
            name={`${fieldName}__editor`}
            type="textarea"
            autoComplete="off"
            variant={props.variant || ''}
            traits={{
              afterIcon: {
                icon: tagsVisible ? 'fa-chevron-up' : 'fa-chevron-down',
                onClick: (e?: React.MouseEvent) => {
                  e?.preventDefault?.();
                  e?.stopPropagation?.();
                  setTagsVisible(v => !v);
                }
              }
            }}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              editingIdx !== null ? 'Edit tag… (Enter to save)' : (props.placeholder ?? 'Type and press Enter…')
            }
          />
        </div>
        {tagsVisible && (
          <div className="ui-multi-select__tag--container">
            <UiMultiSelectTags
              tags={valueArray}
              onEdit={startEdit}
              onRemove={handleRemove}
              editingIdx={editingIdx}
              direction={navSide}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default UiMultiSelect;
