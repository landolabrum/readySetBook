import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./UiSelect.scss";
import UiMenu from "../../../UiMenu/UiMenu";
import UiInput from "../UiInput/controller/UiInput";
import { useModal } from "../../../Containers/modal/contexts/modalContext";
import { ITraits } from "@webstack/components/UiForm/components/FormControl/FormControl";
import {
  buildAfterIcon,
  computeSelectedLabel,
  filterOptions,
  hasNestedOptions,
  isAnySelected,
  isTitleObject,
  normalizeOptions,
  submenuSideClass,
  TitleProps
} from "./functions/helpers";
export interface ISelect {
  label?: string;
  options?: any[];
  onSelect?: (value: any) => void;
  openDirection?: "up" | "down" | "left" | "right";
  onToggle?: (isOpen: boolean) => void;
  title?: TitleProps;
  openState?: string;
  search?: boolean;
  overlay?: boolean | { zIndex: number };
  value?: string;
  traits?: ITraits;
  variant?: any;
  size?: any;
  clearable?: boolean;
  input?: boolean;
}

const UiSelect: React.FC<ISelect> = ({
  options = [],
  size,
  onSelect,
  openDirection = "down",
  onToggle,
  title,
  variant,
  openState,
  value,
  label,
  traits,
  search,
  overlay,
  clearable,
  input
}) => {
  const [isOpen, setIsOpen] = useState<"open" | "closed">("closed");
  const [title_, setTitle] = useState<any | number>("");
  const { isModalOpen, openModal, closeModal } = useModal();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState<string>("");

  // Inline search (owned by UiSelect)
  const [searchValue, setSearchValue] = useState<string>("");

  // Track nested menu state when options contain child items
  const [activeParent, setActiveParent] = useState<any | null>(null);

  // Fade-out state for delayed close
  const [isFading, setIsFading] = useState(false);

  // Close-on-hover-away timer
  const closeTimeoutRef = useRef<number | null>(null);

  // ✅ Container ref for focusing without UiInput refs
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Add user-provided custom option in input mode
  const normalizedOptions = useMemo(
    () => normalizeOptions(options, input, customInput),
    [options, input, customInput]
  );

  const hasNested = useMemo(
    () => hasNestedOptions(normalizedOptions),
    [normalizedOptions]
  );

  // Filter options by label/name/value based on searchValue (only when open+search enabled)
  const filteredOptions = useMemo(
    () => filterOptions(normalizedOptions, isOpen, search, searchValue),
    [normalizedOptions, isOpen, search, searchValue]
  );

  const hasOptions = filteredOptions.length > 0;
  const isMenuOpen = isOpen === "open";

  const hasAnySelected = useMemo(() => isAnySelected(normalizedOptions), [normalizedOptions]);

  const applySelect = (selected: any) => {
    const selectedValue = selected?.value ?? selected;
    if (input) {
      setCustomInput(selectedValue);
      onSelect?.({ label: selectedValue, value: selectedValue });
    } else {
      setSelectedOption(selectedValue);
      onSelect?.(selected);
    }
    setIsOpen("closed");
  };

  const openMenu = (focusSearch = false) => {
    if (variant === "disabled" || !options?.length) return;
    setIsFading(false);
    setIsOpen("open");
    if (overlay) {
      typeof overlay === "object" && overlay?.zIndex
        ? openModal({ zIndex: overlay.zIndex, overlayOnly: true })
        : openModal(null);
    }
    if (focusSearch && search) {
      // ✅ focus the native input after render without UiInput refs
      requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector<HTMLInputElement>(
          'input, textarea, [contenteditable="true"]'
        );
        el?.focus();
        (el as any)?.select?.();
      });
    }
  };

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    clearCloseTimeout();
    setIsOpen("closed");
    setIsFading(false);
    setActiveParent(null);
    if (overlay) closeModal();
    if (search) setSearchValue("");
  }, [overlay, search, closeModal, clearCloseTimeout]);

  const handleControlClick = () => {
    if (isMenuOpen) closeMenu();
    else openMenu(true); // clicking current value → open + focus inline search
  };

  const handleClear = useCallback(() => {
    if (!onSelect) return;
    normalizedOptions.forEach((option: any) => {
      if (option.active) onSelect({ ...option, active: false });
    });
    if (input) setCustomInput("");
  }, [normalizedOptions, input, onSelect]);
  const clearAndClose = (e: any) => {
    e.stopPropagation();
    closeMenu();
  };
  useEffect(() => {
    if (openState !== undefined) setIsOpen(openState as any);
  }, [openState]);

  useEffect(() => {
    if (title_ !== title) {
      if (typeof title === "string") setTitle(title);
      if (typeof title === "object" && "text" in title && title.text !== undefined) {
        setTitle(title.text);
      }
    }
  }, [title, title_]);

  useEffect(() => {
    if (isMenuOpen && onToggle) onToggle(isMenuOpen);
  }, [isMenuOpen, isModalOpen, onToggle]);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const root = containerRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      if (target && !root.contains(target)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, closeMenu]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      clearAndClose(e)
    }
  };

  const selectedLabel = useMemo(
    () => computeSelectedLabel(normalizedOptions, value),
    [normalizedOptions, value]
  );

  const handleTopSelect = (selected: any) => {
    if (selected && Array.isArray(selected.items) && selected.items.length) {
      setActiveParent(selected);
      return;
    }
    applySelect(selected);
  };

  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    setIsFading(false);
  }, [clearCloseTimeout]);

  const handleMouseLeave = useCallback(() => {
    if (!isMenuOpen) return;
    clearCloseTimeout();
    setIsFading(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeMenu();
    }, 1200);
  }, [isMenuOpen, closeMenu, clearCloseTimeout]);

  useEffect(() => () => clearCloseTimeout(), [clearCloseTimeout]);

  return (
    <>
      <style jsx>{styles}</style>
      <div
        ref={containerRef}            // ✅ container ref
        className={`select ${openDirection} ${size ? ` select-${size}` : ""}`}
        style={traits?.width ? { width: `${traits.width}px` } : {}}
        data-element="ui-select"
        onMouseEnter={handleMouseEnter}
        >

        {
        Boolean(isMenuOpen && search) ? (
          <UiInput
            data-element="select"
            type="text"
            label={label}
            size={size}
            variant={hasOptions && variant !== "disabled" ? variant : "select__disabled"}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onKeyDown={onSearchKeyDown}
            // ❌ no ref here; focusing handled via containerRef + querySelector
            traits={{
              beforeIcon: traits?.beforeIcon || isTitleObject(title) && title.beforeIcon && title ? title?.beforeIcon : undefined,
              afterIcon: buildAfterIcon({
                traits,
                variant,
                isMenuOpen,
                openDirection,
                clearAndClose
              }),
            }}
          />
        ) : (
          <UiInput
            data-element="select"
            type={input ? "text" : "button"}
            label={label}
            size={size}
            onClick={handleControlClick}
            onChange={e => input && setCustomInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (input && customInput) {
                  onSelect?.({ label: customInput, value: customInput });
                  setIsOpen("closed");
                } else {
                  openMenu(true);
                }
              }
            }}
            onBlur={() => {
              if (input && customInput) {
                onSelect?.({ label: customInput, value: customInput });
              }
            }}
            variant={variant !== "disabled" ? variant : "select__disabled"}
            value={
              input
                ? customInput || (typeof value === 'string' ? value : '')
                : typeof value === 'string'
                  ? (selectedLabel ?? value)
                  : title_ || selectedOption || "Select"
            }
            traits={{
              beforeIcon: traits?.beforeIcon || undefined,
              afterIcon: buildAfterIcon({
                traits,
                variant,
                isMenuOpen,
                openDirection,
                clearAndClose
              }),
            }}
          />
        )
        }

        {/* Dropdown */}
        {isMenuOpen && variant !== "disabled" && (
          <div
            className={`select__options ${openDirection} ${variant ? " " + variant : ""}${isFading ? " select__options--fading" : ""}`}
            onMouseEnter={handleMouseEnter}
            onClick={closeMenu}
          >
            {clearable && hasAnySelected && (
              <div className="select__clear" onClick={handleClear} />
            )}

            {hasNested ? (
              <div className={`select__options-inner ${submenuSideClass(openDirection)}`}>
                <UiMenu
                  size={size}
                  traits={traits}
                  options={filteredOptions}
                  onSelect={handleTopSelect}
                  onHoverOption={(opt: any) => {
                    if (opt && Array.isArray((opt as any).items) && (opt as any).items.length) {
                      setActiveParent(opt);
                    }
                  }}
                  variant={filteredOptions.length && variant || undefined}
                  value={input ? customInput : value}
                  onClose={closeMenu}
                />

                {activeParent &&
                  Array.isArray((activeParent as any).items) &&
                  (activeParent as any).items.length && (
                    <UiMenu
                      size={size}
                      traits={traits}
                      options={(activeParent as any).items}
                      onSelect={applySelect}
                      variant={variant}
                      value={undefined}
                      onClose={closeMenu}
                    />
                  )}
              </div>
            ) : (
              <UiMenu
                size={size}
                traits={traits}
                options={filteredOptions}
                onSelect={applySelect}
                variant={filteredOptions.length && variant || undefined}
                value={input ? customInput : value}
                onClose={closeMenu}
              />
            )}

            {search && !filteredOptions.length && (
              <div className="select__no-results">No matches</div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default UiSelect;;
