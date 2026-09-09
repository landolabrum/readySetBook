import React from "react";
import styles from "./UiToggle.scss";
import FormControl from "../FormControl/FormControl";

interface IToggle {
  name: string;
  disabled?: boolean;
  label?: string;
  labelDirection?: "vertical" | "horizontal";
  value?: boolean | 'true' | 'false';
  width?: string;
  onChange?: (checked: any) => void;
  message?: string | React.ReactElement;
}

const ToggleSwitch = ({ value, onChange, name, label, disabled, message, width, labelDirection }: IToggle) => {
  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newE = {
      target: {
        name,
        value: e.target.checked,
      },
    };
    if (!disabled && onChange) onChange(newE);
  };
  const checked = value === true || value === "true";
  return (
    <>
      <style jsx>{styles}</style>
      <span className='ui-toggle'>

        {label !== undefined && label?.length && <label className={`ui-toggle__label ${
          // labelDirection
          labelDirection === "vertical" ? "ui-toggle__label--vertical" : "ui-toggle__label__horizontal"
          }`}>{label}</label>}
        <FormControl variant='checkbox' traits={{width:width}}>
          <label className="toggle-switch">
            <input
              disabled={disabled}
              name={name}
              type="checkbox"
              checked={checked}
              onChange={handleToggle}
            />
            <span className={`slider ${disabled && ' slider--disabled' || ''}`} />
          </label>
        </FormControl>

        {message && <div>{message}</div>}
      </span>
    </>
  );
};

export default ToggleSwitch;
