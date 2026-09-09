// UiList.tsx
import React, { FC, ReactNode, MouseEvent } from "react";
import { IFormControl } from "@webstack/components/UiForm/components/FormControl/FormControl";
import styles from "./UiList.scss";
import UiButton from "../UiForm/components/UiButton/UiButton";

export type IUiListItem = {
  name?: string;
  label?: string;
  title?: string | ReactNode;
  markDownString?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  children?: string | React.ReactFragment | React.ReactElement | ReactNode;
};

export interface IUiListProps extends IFormControl {
  items?: IUiListItem[];
  onClose?: (e: any) => void;
  traits?: any;
  size?: any;
  variant?: string;
}

const UiList: FC<IUiListProps> = ({
  items = [],
  variant,
  size,
  traits,
  onClose,
}) => {
  const classMaker = (cName: string) => {
    const variantParts = variant?.split(" ") || [];
    if (variantParts.length < 1) return `${cName}__flat    `;
    else if (variantParts.length > 1) return `${cName}__${variantParts.join(` ${cName}__`)}    `;
    return `${cName}__${variantParts[0]}    `;


  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="ui-list-container">
        {onClose && (
          <div className="ui-list__close">
            <UiButton
              size="sm"
              variant={variant ?? "flat"}
              traits={{ afterIcon: "fa-xmark" }}
              onClick={onClose}
            >
              close
            </UiButton>
          </div>
        )}

        <div
          className={`ui-list ${variant ? classMaker("ui-list") : "ui-list__flat"
            }${size ? ` ui-list-${size}` : ""}`}
          style={
            traits?.height
              ? { ...traits, overflowY: "auto" }
              : (traits ?? {})
          }
          role="list"
        >
          {items.map((item, index) => {
            const key = item.name ?? item.label ?? index;

            const handleClick = (e: MouseEvent<HTMLElement>) => {
              item.onClick?.(e);
            };

            return (
              <div
                key={key}
                className={`ui-list__item${size ? ` ui-list__item-${size}` : ""
                  }${item.onClick ? " ui-list__item-clickable" : ""}`}
                onClick={item.onClick ? handleClick : undefined}
                role="listitem"
              >
                {(item.title || item.label) && (
                  <div className="ui-list__item-header">
                    {item.title && (
                      <div className="ui-list__item-title">
                        {item.title}
                      </div>
                    )}
                    {item.label && (
                      <div className="ui-list__item-label">
                        {item.label}
                      </div>
                    )}
                  </div>
                )}

                {item.markDownString && !item.children && (
                  <div className="ui-list__item-body ui-list__item-markdown">
                    {/*
                      Deliberately not parsing markdown here to avoid
                      adding dependencies / guessing your stack.
                      Pass rendered markdown as `children` if needed.
                    */}
                    {item.markDownString}
                  </div>
                )}

                {item.children && (
                  <div className="ui-list__item-body">
                    {item.children}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default UiList;
