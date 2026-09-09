import React, { useState, useEffect, useRef } from 'react';
import UiInput from '../components/UiInput/controller/UiInput';
import UiUpload from '../components/UiUpload/controller/UiUpload';
import styles from './UiForm.scss';
import UiButton from '../components/UiButton/UiButton';
import { IForm, IFormField } from '../models/IFormModel';
import UiSelect from '../components/UiSelect/UiSelect';
import UiLoader from '../../UiLoader/view/UiLoader';
import ToggleSwitch from '../components/UiToggle/UiToggle';
import FormControl from '../components/FormControl/FormControl';
import AddFieldForm from '../views/AddFieldForm/AddFieldForm';
import AutocompleteAddressInput from '@webstack/components/UiForm/components/UiInput/views/AddressInput/controller/AddressInput';
import { fieldType } from '../functions/formFieldFunctions';
import UiMultiSelect from '../components/UiMultiSelect/controller/UiMultiSelect';
import ColorPicker from '@webstack/components/ColorPicker/ColorPicker';
import UiPill from '../components/UiPill/UiPill';

const fieldGridColumn = (width?: string): string => {
  if (!width) return '1 / -1';
  const pct = parseFloat(width);
  if (isNaN(pct) || pct >= 100) return '1 / -1';
  return 'span 1';
};

const UiForm = ({
  variant,
  fields,
  onSubmit,
  onError: onLocalErrors,
  title,
  submitText,
  submitIcon,
  onChange,
  loading,
  disabled,
  onAddField,
  size
}: IForm): React.JSX.Element => {

  const [complete, setComplete] = useState<boolean>(false);
  const [localErrors, setLocalErrors] = useState<any>({});

  const handleComplete = () => {
    if (!fields) return;
    const required = fields.filter((f: any) => f.required);
    const allReady = required.length === 0 || required.every((f: any) => ![undefined, '', null].includes(f.value));
    setComplete(allReady);
  };

  const handleInputChange = (e: any, constraints?: IFormField['constraints']) => {
    if (onChange) return onChange(e);
  };

  // const handleClick = (e: any, constraints?: IFormField['constraints']) => {
  //   console.log({ e: e?.onClick })
  //   // if (e) return onClick(e);
  // };

  const handleFileUpload = (fieldName: string, file: File) => {
    const targetField = fields && fields.find((f) => f.name === fieldName);

    // Fallback: no field metadata, behave like single-file input
    if (!targetField) {
      return handleInputChange({ target: { name: fieldName, value: file } });
    }

    const isMultiple = Boolean(targetField.multiple);
    if (!isMultiple) {
      return handleInputChange({ target: { name: fieldName, value: file } });
    }

    // Filter existing values to only include actual File instances
    const existing = Array.isArray(targetField.value)
      ? (targetField.value as any[]).filter((v): v is File => v instanceof File)
      : targetField.value instanceof File
        ? [targetField.value as File]
        : [];

    const value = [...existing, file];
    handleInputChange({ target: { name: fieldName, value } });
  };

  const handleFileUrlsChange = (fieldName: string, urls: string[]) => {
    const targetField = fields && fields.find((f) => f.name === fieldName);
    const existing = Array.isArray(targetField?.value)
      ? targetField!.value
      : targetField?.value
        ? [targetField.value]
        : [];
    const fileParts = existing.filter((v) => v instanceof File);
    const next = [...fileParts, ...(urls || [])];
    handleInputChange({ target: { name: fieldName, value: next } });
  };

  const handleFileRemove = (fieldName: string, index: number) => {
    const targetField = fields && fields.find(f => f.name === fieldName);
    if (!targetField) return;

    const newValue = Array.isArray(targetField.value)
      ? targetField.value.filter((_: any, i: number) => i !== index)
      : [];

    handleInputChange({ target: { name: fieldName, value: newValue } });
  };

  const handleFileReorder = (fieldName: string, from: number, to: number) => {
    const targetField = fields && fields.find(f => f.name === fieldName);
    if (!targetField) return;

    const current = Array.isArray(targetField.value)
      ? targetField.value
      : targetField.value
        ? [targetField.value]
        : [];

    if (
      from < 0 ||
      to < 0 ||
      from >= current.length ||
      to >= current.length
    ) {
      return;
    }

    const next = current.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    handleInputChange({ target: { name: fieldName, value: next } });
  };

  const handleSubmit = () => {
    if (!fields || !onSubmit) return;

    let newErrors = { ...localErrors };

    fields.forEach((f: any) => {
      if (f.constraints) {
        const min = f.constraints?.min;
        const max = f.constraints?.max;
        const valueLen = String(f.value).replaceAll(' ', '').length;
        if (min != undefined && valueLen) {
          if (localErrors[f.name] !== undefined) { delete newErrors[f.name]; }
          else if (valueLen < min) { newErrors[f.name] = `*${f.name} is not long enough`; }
        }
        if (max != undefined) {
          if (localErrors[f.name] !== undefined) { delete newErrors[f.name]; }
          else if (valueLen > max) { newErrors[f.name] = `*${f.name} is too long`; }
        }
      }
    });
    setLocalErrors(newErrors);

    if (Object.keys(newErrors).length == 0) {
      onSubmit(fields);
    } else if (onLocalErrors) {
      onLocalErrors(newErrors);
    }
  };


  const fieldsCanPopulate = Array(fields)?.length;

  useEffect(() => {
    handleComplete();
  }, [fields]);

  if (!fields) return <div className='error'>No form fields</div>;

  return (
    <>
      <style jsx>{styles}</style>
      {title && <div className="form__title">{title}</div>}
      <form className={`form ${(
        variant && ` form--${variant}`
      ) || ""} ${size ? `form--${size}` : ''}`}>
        {fieldsCanPopulate &&
          fields.map(
            (field, index) =>
              field.name &&
              field.readonly === true && (
                <div
                  key={index}
                  className={`form-field__readonly ${field.error && "error"} ${size && `form-field--${size}`}`}
                // style={field?.width ? { width: `calc(${field.width} - 8px)` } : {}}
                >
                  <div className="form-field__readonly--label">{field?.label}</div>
                  <div className="form-field__readonly--value">
                    {(typeof field.value !== "object" && `${field?.value}`) ||
                      (field.value && (
                        <div className="object-list">
                          {Object.entries(field.value).map(([chK, chV]: any) => (
                            <span className="object-item" key={chK}>
                              <span className="object-item--key">{chK}:</span>
                              <span className="object-item--value">{JSON.stringify(chV).replaceAll('"', "")}</span>
                            </span>
                          ))}
                        </div>
                      ))}
                  </div>
                </div>
              )
          )}

        {fieldsCanPopulate &&
          fields.map(
            (field, index) =>
              field.name &&
              !field.readonly && (
                <div
                  style={{ gridColumn: fieldGridColumn(field?.width) }}
                  key={index}
                  className={`form-field ${size && `form-field--${size}` || ''}
                  ${field?.variant ? `form-field--${field?.variant}`:''}
                  `}
                // style={typeof field?.width == "string" ? { width: `calc(${field.width} - calc(var(--s-9)*2))` } : {}}
                >
                  {fieldType(field) == "button" && (
                    <UiButton
                      traits={{ width: field?.width }}
                      variant={Boolean(field?.error) ? "invalid" : variant || field?.variant}

                      name={field?.name} onClick={field?.onClick}>
                      {field?.label || field?.name || "N/A"}
                    </UiButton>
                  )}
                  {fieldType(field) == "multi-select" && (
                    <UiMultiSelect
                      {...field}
                      value={Array.isArray(field.value) ? (field.value as string[]) : []}
                      onChange={(e) => handleInputChange(e)}
                    />
                  )}

                  {fieldType(field) == "file" && (
                    <UiUpload
                      title={field.placeholder || "Upload File"}
                      onFileUpload={(file) => handleFileUpload(field.name, file)}
                      onUrlsChange={(urls) => handleFileUrlsChange(field.name, urls)}
                      onFileRemove={(index) => handleFileRemove(field.name, Number(index))}
                      onReorder={(from, to) => handleFileReorder(field.name, from, to)}
                      accept={field?.accept || '*/*'}
                      multiple={field?.multiple}
                      maxFiles={field?.maxFiles}
                      label={field?.label}

                      value={
                        Array.isArray(field?.value)
                          ? field.value.map((file: any) =>
                            file instanceof File
                              ? {
                                src: URL.createObjectURL(file),
                                name: file.name,
                                type: file.type,
                              }
                              : typeof file === "string" || typeof file === "number"
                                ? { src: String(file) }
                                : file
                          )
                          : []
                      } // Pass the existing files (preloaded) here
                    />
                  )}
                  {fieldType(field) == "text" && (
                    <UiInput
                      size={size}
                      autoComplete={field.autoComplete}
                      label={field.label}
                      variant={Boolean(field?.error) ? "invalid" : variant || field?.variant}
                      disabled={field?.disabled}
                      error={field.error}
                      type={field.type}
                      required={field.required}
                      traits={{
                        ...field.traits,
                        // width: field.width
                      }}
                      name={field.name}
                      placeholder={field.placeholder}
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(e) => handleInputChange(e, field.constraints)}
                      onKeyDown={(field?.onKeyDown) ? (e) => field.onKeyDown(e) : undefined}
                    />
                  )}
                  {fieldType(field) == "address" && (
                    <div className="s-w-100">
                      <AutocompleteAddressInput
                        variant={Boolean(field?.error) ? "invalid" : variant || field?.variant}
                        label={field.label || "address"}
                        address={field.value}                             // ✅ controlled value
                        error={field?.error}
                        name={field.name}
                        setAddress={(e) => handleInputChange(e, field.constraints)}
                        size={size}
                      />
                    </div>
                  )}

                  {fieldType(field) == "radio" && (
                    <ToggleSwitch
                      label={field.label}
                      name={field.name}
                      disabled={field?.disabled}
                      onChange={(e) => handleInputChange(e, field?.constraints)}
                      value={Boolean(field?.value)}
                    />
                  )}

                  {fieldType(field) == "checkbox" && (
                    <>
                      <ToggleSwitch
                        label={field.label}
                        name={field.name}
                        disabled={field?.disabled}

                        onChange={(e) => handleInputChange(e, field?.constraints)}
                        value={Boolean(field?.value)}
                      />
                      <div className="field-msg">{field?.msg}</div>
                    </>
                  )}
                  {fieldType(field) == "select" && (
                    <UiSelect
                      size={size}
                      variant={field?.variant || variant}
                      traits={{ ...field.traits, width: field.width }}
                      options={field?.options}
                      label={field.name}
                      value={String(field?.value ?? '')}
                      input={field?.input ? Boolean(field.input) : undefined}
                      clearable={field.clearable}
                      onSelect={(e) => {
                        // When clearable fires with active:false, emit '' to actually clear the field
                        const val = (e?.active === false) ? '' : e;
                        handleInputChange({ target: { name: field.name, value: val } }, field.constraints);
                      }}
                    />
                  )}

                  {fieldType(field) == "pill" && (
                    <UiPill
                      name={field.name}
                      label={field?.error ? `${field.label} *${field.error}*` : field.label}
                      variant={
                        (field.error && "invalid") ||
                        (Boolean((field?.min && field.value == field.min) || (field.max && field.value == field.max)) &&
                          "bump pill") ||
                        "pill"
                      }
                      amount={
                        typeof field.value === 'number'
                          ? field.value
                          : field.value === "" || field.value === undefined || field.value === null
                            ? 0
                            : Number(field.value)
                      }
                      increment={field?.step || 0.1}
                      min={field?.min ?? 0}
                      traits={{ ...field.traits, width: field.width }}
                      setAmount={(qty: number) => {
                        let next = qty;
                        if (field?.min !== undefined && next < field.min) next = field.min;
                        if (field?.max !== undefined && next > field.max) next = field.max;
                        handleInputChange({ target: { name: field.name, value: next } }, field.constraints);
                      }}
                    />
                  )}

                  {fieldType(field) == "color" && (
                    <ColorPicker
                      name={field.name}
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(e) => handleInputChange(e, field.constraints)}
                    />
                  )}
                </div>
              )
          )}

        {!fieldsCanPopulate && <UiLoader position="relative" />}

        {onAddField && <AddFieldForm onAddField={onAddField} />}

        {onSubmit && (
          <div className={`form__submit ${(variant && ` form__submit--${variant}`) || ""}`}>
            <div className={`form__submit--button form__submit--button--${!disabled && complete ?'':"in"}complete`}>
              <UiButton
                size={size}
                onClick={handleSubmit}
                traits={{ afterIcon: submitIcon }}
                disabled={disabled || !complete}
                // variant="inherit"
                variant={!disabled && complete? "glow inherit":"inherit"}
                type="submit"
                busy={loading == true}
              >
                {submitText ? submitText : "Submit"}
              </UiButton>
          </div>
          </div>
        )}
      </form>
    </>
  );
};

export default UiForm;
