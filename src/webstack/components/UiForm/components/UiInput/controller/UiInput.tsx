import styles from "./UiInput.scss";
import type { NextComponentType, NextPageContext } from "next";
import FormControl from "../../FormControl/FormControl";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { IInput } from "@webstack/models/input";
import { validateInput } from "../helpers/validateInput";
import maskInput from "../helpers/maskInput";
import AutocompleteAddressInput from "../views/AddressInput/controller/AddressInput";
import { debounce } from "lodash";
import UiInputTool from "@webstack/components/UiForm/components/UiInput/views/UiInputTool/controller/UiInputTool";
// import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import UiMarkdown from "@webstack/components/UiMarkDown/controller/UiMarkDown";

const UiInput: NextComponentType<NextPageContext, {}, IInput> = (props: IInput) => {
  const {
    name, type, value, onChange, onKeyDown, onKeyUp, message, required,
    size, onDelete, onClick, accept, id, placeholder, min, max,
    autoComplete, autoFill, onPaste, variant, disabled, traits, innerRef, readonly,
    multiple,
  } = props;

  const [show, setShow] = useState<boolean>(false);
  const internalRef = useRef<HTMLInputElement>(null);
  const fileInputRef = innerRef || internalRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isMarkdown = Boolean(variant && String(variant).includes('markdown'));

  const handleChange = (e: any) => {
    if (type === 'file' && e.target.files?.length) {
      const files = e.target.multiple ? Array.from(e.target.files) : e.target.files[0];
      const _e = {
        target: {
          name: e.target.name,
          value: files,
          files: e.target.files, // explicitly include files
        }
      };
      if (onChange) onChange(_e);
      return;
    }

    if (max && e.target.value.length > max) return;

    let _e: any = {
      target: {
        value: e?.target?.value || "",
        name: e?.target?.name || ""
      }
    };

    // Detect inline icon token '::query' based on caret position BEFORE masking
    const raw = String(e?.target?.value ?? "");
    const caretPos: number | null = typeof e?.target?.selectionStart === 'number' ? e.target.selectionStart : null;
    if ((type === 'text' || type === 'textarea' || !type || type == 'multi-select') && caretPos !== null) {
      const head = raw.slice(0, caretPos);
      const match = head.match(/::([^\s]*)$/);
      if (match) {
        setShowPicker(true);
        setPickerFilter(match[1] || "");
      } else {
        setShowPicker(false);
        setPickerFilter("");
      }
    }

    let [newV, extra] = maskInput(e, type);
    _e.target.value = extra !== undefined ? [newV, extra] : newV;

    if (onChange) onChange(_e);
  };


  const inputValue = value !== undefined && value !== null ? value : '';
  const debouncedChangeHandler = useCallback(debounce(handleChange, 1000), []);
  const showMarkdownMask = isMarkdown && !isFocused && !isHovered && Boolean(inputValue && String(inputValue).length);

  const inputClasses = [
    variant || "",
    validateInput(value, type) ? "" : "invalid",
    disabled ? "input-disabled" : "",
    traits?.beforeIcon ? "input__has-icons" : "",
    showMarkdownMask ? "input__markdown-masked" : "",
  ].join(" ");
  const allowAutoFill = autoFill !== false;
  const resolvedAutoComplete = allowAutoFill ? autoComplete : "off";
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");
  const elType = show && type === "password" ? "text" : type;
  const isTextArea = String(value).length > 100 || type === "textarea";
  const isCaretEligible = useMemo(() => {
    if (isTextArea) return true;
    const normalized = (elType || "").toLowerCase();
    if (!normalized) return true;
    return ["text", "search", "email", "password", "tel", "url", "number"].includes(normalized);
  }, [elType, isTextArea]);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onDelete && (e.key === 'Backspace' || e.key === 'Delete')) {
      onDelete({ name: e.currentTarget.name, value: e.currentTarget.value });
    }
    if (onKeyDown) onKeyDown(e);
  };
  const focusInputElement = useCallback((opts?: { placeCaretAtEnd?: boolean }) => {
    if (!isCaretEligible || disabled || readonly) return;
    const el = fileInputRef?.current as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    el.focus();
    if (opts?.placeCaretAtEnd && typeof el.setSelectionRange === 'function') {
      const normalizedValue = typeof inputValue === 'string' ? inputValue : String(inputValue ?? '');
      try {
        el.setSelectionRange(normalizedValue.length, normalizedValue.length);
      } catch {
        // Non-textual inputs (e.g., number in some browsers) may throw; ignore.
      }
    }
  }, [disabled, readonly, fileInputRef, inputValue, isCaretEligible]);
  const handleContainerClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== fileInputRef.current) {
      focusInputElement({ placeCaretAtEnd: true });
    }
    if (onClick) onClick(event);
  }, [focusInputElement, fileInputRef, onClick]);
  const handleFieldClick = useCallback((event: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    event.stopPropagation();
    focusInputElement();
    if (onClick) onClick(event);
  }, [focusInputElement, onClick]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback((e: React.FocusEvent) => {
    setIsFocused(false);
    if (props.onBlur) props.onBlur(e as any);
  }, [props.onBlur]);

  /** Clicking the markdown mask should reveal the raw input for editing */
  const handleMaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    focusInputElement({ placeCaretAtEnd: true });
  }, [focusInputElement]);


  const handleIconSelect = (iconName: string) => {
    const el = fileInputRef?.current as HTMLInputElement | HTMLTextAreaElement | null;
    const currentVal = typeof inputValue === 'string' ? inputValue : String(inputValue ?? '');
    const caret = el && typeof el.selectionStart === 'number' ? (el.selectionStart as number) : currentVal.length;
    const head = currentVal.slice(0, caret);
    const match = head.match(/::([^\s]*)$/);
    if (!match || match.index == null) {
      setShowPicker(false);
      setPickerFilter("");
      return;
    }
    const start = match.index; // index of first ':' in '::'
    const before = currentVal.slice(0, start);
    const after = currentVal.slice(caret);
    const insertText = iconName + ' ';
    const updated = before + insertText + after;
    onChange && onChange({ target: { name: name ?? id ?? '', value: updated } });
    setShowPicker(false);
    setPickerFilter("");
    setTimeout(() => {
      const el2 = fileInputRef?.current as HTMLInputElement | HTMLTextAreaElement | null;
      if (el2) {
        const newCaret = before.length + insertText.length;
        try {
          el2.focus();
          el2.setSelectionRange(newCaret, newCaret);
        } catch { }
      }
    }, 0);
  };

  const resolvedTraits = useMemo(() => {
    const baseTraits = {
      ...(traits || {}),
      disabled,
      width: traits?.width ?? '100%',
      maxWidth: traits?.maxWidth ?? '100%',
    };

    if (type === "password") {
      baseTraits.afterIcon = {
        icon: show ? "fa-eye" : "fa-eye-slash",
        onClick: () => setShow(prev => !prev)
      };
    }
    if(type == 'markdown'||variant=='markdown'){
      // if(baseTraits.afterIcon)return;
      baseTraits.afterIcon = {
        icon: isHovered ? "fa-eye" : "fa-eye-slash",
        onClick: () => setIsHovered(prev => !prev)
      };
    }
    return baseTraits;
  }, [traits, disabled, type, show, isHovered]);


  return (
    <>
      <style jsx>{styles}</style>
      <div
        className={`ui-input${showMarkdownMask ? ' ui-input--masked' : ''}`}
        ref={containerRef}
        // onMouseEnter={() => setIsHovered(true)}
        // onMouseLeave={() => setIsHovered(false)}
      >
        {!showMarkdownMask && variant && variant?.includes('markdown') && value?.length ? (
          <fieldset className="ui-input__markdown-preview">
            <legend>{Boolean(props?.label || props?.name) && <><b > {props?.label || props?.name}: </b></>} markdown preview</legend>
            <UiMarkdown text={inputValue} />
          </fieldset>
        ) : undefined}
        {name !== 'address' ? (
          <FormControl
            {...props}
            onClick={handleContainerClick}
            traits={resolvedTraits}
          >
            {!isTextArea ? (
              <input
                ref={fileInputRef}
                onClick={handleFieldClick}
                data-element="input"
                disabled={disabled}
                id={id ?? name}
                className={inputClasses}
                name={name}
                accept={accept}
                multiple={multiple}
                type={elType}
                placeholder={placeholder}
                min={min}
                max={max}
                value={inputValue}
                onChange={elType !== 'color' ? handleChange : debouncedChangeHandler}
                autoComplete={resolvedAutoComplete}
                autoCorrect={allowAutoFill ? undefined : "off"}
                autoCapitalize={allowAutoFill ? undefined : "none"}
                spellCheck={allowAutoFill ? undefined : false}
                onKeyDown={handleKeyDown}
                onKeyUp={onKeyUp}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onPaste={onPaste}
                required={Boolean(required)}
                readOnly={readonly}
                style={size ? { width: `calc(${size}ch + 1em)` } : undefined}
              />

            ) : (
              <textarea
                ref={fileInputRef as any}
                data-element="textarea"
                disabled={disabled}
                id={id}
                className={inputClasses}
                name={name}
                placeholder={placeholder}
                value={inputValue}
                onChange={handleChange}
                onClick={handleFieldClick}
                autoComplete={resolvedAutoComplete}
                autoCorrect={allowAutoFill ? undefined : "off"}
                autoCapitalize={allowAutoFill ? undefined : "none"}
                spellCheck={allowAutoFill ? undefined : false}
                onKeyDown={handleKeyDown}
                onKeyUp={onKeyUp}
                onPaste={onPaste}
                required={Boolean(required)}

                onFocus={handleFocus}
                onBlur={handleBlur}
                readOnly={readonly}

              />
            )}
          </FormControl>
        ) : (
          <AutocompleteAddressInput
            label={props.label}
            placeholder={placeholder}
            inputClasses={inputClasses}
            traits={{ ...traits }}
            error={props.error}
            size={size}
            address={value}
            variant={variant}
            setAddress={handleChange}
          />
        )}
        <UiInputTool
          open={showPicker}
          filter={pickerFilter}
          inputRef={fileInputRef}
          onSelect={handleIconSelect}
        />
        {showMarkdownMask && (
          <div className='input__markdown-mask' onClick={handleMaskClick} aria-hidden>
            <UiMarkdown text={inputValue} />
          </div>
        )}
        <div className={`input__message ${message ? 'input__message-show' : ''}${variant ? ' input__message-' + variant : ''}`}>
          {message}
        </div>
      </div>
    </>
  );
};

export default UiInput;
