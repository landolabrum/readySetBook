import React, { FC, useEffect, useState } from "react";
import { IFormControl } from "@webstack/components/UiForm/components/FormControl/FormControl";
import styles from "./UiMenu.scss";
import UiButton from "../UiForm/components/UiButton/UiButton";

export type IMenuOption = {
  label: string;
  value: string;
  secondary?: string;
  icon?: any;            // string or { icon, color }
  active?: boolean;
  selected?: boolean;
};

export interface IMenu extends IFormControl {
  options?: IMenuOption[];
  onClose?: (e: any) => void;
  onSelect?: (value: any) => void;
  onHoverOption?: (value: any) => void;
  value?: string;
  traits?: any;
  size?: any;
  variant?: string;
}

const UiMenu: FC<IMenu> = ({
  options = [],
  variant,
  onSelect,
  onHoverOption,
  value,
  size,
  traits,
  onClose
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    if (value != null) setSelectedOption(value);
  }, [value]);

  const resolveOptionValue = (option: IMenuOption, index: number) =>
    option.value ?? option.label ?? String(index);

  const handleSelect = (option: IMenuOption, resolvedValue: string) => {
    setSelectedOption(resolvedValue);
    onSelect?.(option);
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="menu-container">
        {/* {onClose && (
          <div className="menu__close">
            <UiButton
              size="sm"
              variant={variant ?? "inherit"}

              traits={{ afterIcon: "fa-xmark" }}
              onClick={onClose}
            >
              close
            </UiButton>
          </div>
        )} */}

        <div
          className={`menu ${variant ? `menu__${variant}` : "inherit"}${size ? ` menu-${size}` : ""}`}
          style={traits?.height ? { ...traits, overflowY: "auto" } : (traits ?? {})}
          role="listbox"
        >
          {options.map((option, index) => {
            const optionValue = resolveOptionValue(option, index);
            const isDisabled = option.active === false;
            const isActive =
              !isDisabled &&
              (selectedOption === optionValue || option.selected || option.active);

            return (
              <div
                key={option.value ?? index}
                className={`menu__option ${variant ?? ""}${isDisabled ? " disabled" : " "}${isActive ? " active" : " inherit"}${size ? ` menu__option-${size}` : ""}`}
                onClick={() => {
                  if (isDisabled) return;
                  handleSelect(option, optionValue);
                }}
                onMouseEnter={() => {
                  if (isDisabled) return;
                  onHoverOption && onHoverOption(option);
                }}
                role="option"
                aria-selected={isActive}
              >
                <UiButton
                  variant={variant ?? "inherit"}
                  size={size}
                  traits={{
                    beforeIcon: option.icon,
                    afterIcon: isActive ? { icon: "fa-check" } : ""
                  }}
                >
                  <span className="menu__option-primary">{option.label}</span>
                  {option.secondary && (
                    <span className="menu__option-secondary">{option.secondary}</span>
                  )}
                </UiButton>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default UiMenu;
