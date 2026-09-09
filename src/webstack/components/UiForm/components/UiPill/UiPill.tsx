import { useCallback, useState, useRef, useEffect } from 'react';
import styles from "./UiPill.scss";
import { IFormControlVariant } from '../../../AdapTable/models/IVariant';
import UiInput from '../UiInput/controller/UiInput';
import debounce from 'lodash/debounce';
import { ITraits } from '@webstack/components/UiForm/components/FormControl/FormControl';

interface IPill {
  amount: number | string;
  setAmount: (qty: number) => void;
  variant?: IFormControlVariant;
  traits?: ITraits;
  /** step size for + / – buttons (default = 1, supports decimals like 0.4) */
  increment?: number;
  /** minimum allowed value (default = 0, but can be negative if you want) */
  min?: number;
  label?:string;
  name?:string;
  /** show trash icon when at min boundary (default true for backwards compatibility) */
  showTrashAtMin?: boolean;
  /** show trash icon one step above min (useful when decrementing reaches a removal state) */
  showTrashAtMinPlusStep?: boolean;
  /** hide decrement icon entirely when current value is at min */
  hideBeforeIconAtMin?: boolean;
}

const UiPill = ({
  amount,
  setAmount,
  variant,
  traits,
  increment = 1,
  min = 0,
  label,
  name,
  showTrashAtMin = true,
  showTrashAtMinPlusStep = false,
  hideBeforeIconAtMin = false,
}: IPill) => {
  const [value, setValue] = useState<string>(
    () => (amount !== undefined && amount !== null && amount !== "" ? amount.toString() : "0")
  );
  // True while the user is actively editing this field. Prevents the `amount`
  // sync effect below from clobbering an in-progress edit before the debounced
  // commit has round-tripped back through the parent's state.
  const isEditingRef = useRef(false);
  // Always invoke the latest `setAmount`. The debounce is created once, but the
  // parent recreates `setAmount` every render (capturing fresh field bounds /
  // handlers), so a stale closure would commit against stale state.
  const setAmountRef = useRef(setAmount);
  setAmountRef.current = setAmount;

  const handleAmount = useCallback(
    (method: "plus" | "minus") => {
      if (typeof amount === "number") {
        const delta = method === "plus" ? increment : -increment;
        let next = amount + delta;
        if (next < min) next = min;
        // round to avoid floating point artifacts (e.g. 0.30000000000004)
        const rounded = parseFloat(next.toFixed(6));
        isEditingRef.current = false;
        setAmountRef.current(rounded);
      }
    },
    [amount, increment, min]
  );

  const epsilon = 0.000001;
  const atMin = typeof amount === "number" && amount <= min + epsilon;
  const atMinPlusStep =
    typeof amount === "number" && amount <= min + Math.abs(increment) + epsilon;
  const shouldShowTrash =
    (showTrashAtMin && atMin) || (showTrashAtMinPlusStep && atMinPlusStep);

  // default traits: minus / plus buttons with caller-configurable floor behavior
  const defaultTraits: any =
    typeof amount === "number"
      ? {
          beforeIcon: hideBeforeIconAtMin && atMin
            ? undefined
            : {
                icon: shouldShowTrash ? "fa-trash-can" : "fas-minus",
                onClick: () => handleAmount("minus"),
                color: shouldShowTrash ? "red" : "",
              },
          afterIcon: {
            icon: "fas-plus",
            onClick: () => handleAmount("plus"),
          },
        }
      : {};

  const _traits: any = {
    ...defaultTraits,
    ...(traits || {}),
  };

  const commit = useCallback((val: string) => {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) setAmountRef.current(parsed);
  }, []);

  const debouncedHandleInput = useRef(
    debounce((val: string) => commit(val), 300)
  ).current;

  // Cancel any pending debounce on unmount to avoid committing to a torn-down
  // parent; blur already commits synchronously for the normal edit-then-leave flow.
  useEffect(() => () => debouncedHandleInput.cancel(), [debouncedHandleInput]);

  const handleInput = useCallback(
    (e: any) => {
      isEditingRef.current = true;
      setValue(e.target.value);
      debouncedHandleInput(e.target.value);
    },
    [debouncedHandleInput]
  );

  // Commit immediately when the user leaves the field so a fast Save (before the
  // debounce fires) still persists the typed value.
  const handleBlur = useCallback(() => {
    isEditingRef.current = false;
    debouncedHandleInput.cancel();
    commit(value);
  }, [debouncedHandleInput, commit, value]);

  useEffect(() => {
    // Don't overwrite what the user is currently typing.
    if (isEditingRef.current) return;
    if (amount !== undefined && amount !== null && amount !== "") {
      setValue(amount.toString());
    }
  }, [amount]);

  return (
    <>
      <style jsx>{styles}</style>
      <div
        className={`ui-pill ${traits?.responsive ? " ui-pill-responsive" : ""} ${
          variant ? `ui-pill-${variant}` : ""
        }`}
      >
        <UiInput
          name={name?name:"ui-pill"}
          variant={variant}
          traits={_traits}
          label={label}
          value={value}
          onChange={handleInput}
          onBlur={handleBlur}
          size={Math.max(1, String(value).length) as any}
        />
      </div>
    </>
  );
};

export default UiPill;
