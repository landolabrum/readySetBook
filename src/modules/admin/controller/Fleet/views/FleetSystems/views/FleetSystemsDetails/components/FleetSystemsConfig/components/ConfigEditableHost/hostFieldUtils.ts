// Pure transforms backing the editable-host form: JSON blob ⇄ UiForm field
// descriptors, plus value coercion on save. No React/state here.

export const toLabel = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const isObjectArray = (v: any): v is Record<string, any>[] =>
  Array.isArray(v) && v.length > 0 &&
  v.every(x => x !== null && typeof x === 'object' && !Array.isArray(x));

export const pickIdKey = (item: Record<string, any>): string => {
  for (const k of ['id', 'pin', 'key', 'name']) if (k in item) return k;
  return Object.keys(item)[0] ?? '_idx';
};

export const safeStringify = (v: any) => {
  if (v == null) return '';
  try { return JSON.stringify(v, null, 2); } catch { return ''; }
};

// Map one JSON object's entries to UiForm field descriptors.
// Object-arrays (e.g. gpio.relays) are filtered out — they render as
// toggle-button rows alongside the form.
export const objToFields = (obj: Record<string, any>): any[] =>
  Object.entries(obj)
    .filter(([, val]) => !isObjectArray(val))
    .map(([key, val]) => {
      if (typeof val === 'boolean')
        return { name: key, label: toLabel(key), type: 'checkbox', value: val };
      if (typeof val === 'number')
        return { name: key, label: toLabel(key), type: 'pill', value: val };
      if (Array.isArray(val)) {
        const opts = (val as any[]).map((v: any) => ({ label: String(v), value: String(v) }));
        return { name: key, label: toLabel(key), type: 'multi-select', value: val, options: opts };
      }
      if (val !== null && typeof val === 'object')
        return { name: key, label: toLabel(key), type: 'textarea', value: safeStringify(val) };
      return { name: key, label: toLabel(key), type: 'text', value: String(val ?? '') };
    });

// Object-array sub-field state (e.g. gpio.relays): the original items list plus
// a per-id enabled map. Toggling flips `enabled` only, never removes items.
export type ObjArrayState = {
  items: Array<Record<string, any>>;
  enabledMap: Record<string, boolean>;
  idKey: string;
};

// Build UiForm 'button' field descriptors for a section's object-array sub-fields.
// gpio.relays drive the physical pin (live state from `relayOn`); all others just
// toggle the config `enabled` flag. variant flips by `enabled`.
export const buildObjArrayButtonFields = (
  fieldName: string,
  entries: Array<[string, ObjArrayState]>,
  relayOn: Record<string, boolean>,
  onToggleRelay: (relayId: number) => void,
  onToggleItem: (fieldName: string, key: string, id: string | number) => void,
): any[] =>
  entries.flatMap(([k, { items, enabledMap, idKey }]) =>
    items.map(item => {
      const id = item[idKey];
      const label = item.label ?? item.name ?? String(id);
      const pin = item.pin != null ? ` · pin ${item.pin}` : '';

      // Special case: gpio.relays buttons drive the physical pin via /gpio/set.
      // State comes from /gpio/status, not config. Disabled relays (enabled=false)
      // stay non-interactive.
      const isGpioRelay = fieldName === 'gpio' && k === 'relays';
      if (isGpioRelay) {
        const cfgEnabled = enabledMap[String(id)] !== false;
        const on = cfgEnabled && relayOn[String(id)] === true;
        return {
          type: 'button',
          name: `__oa__${k}__${id}`,
          label: `${on ? '● ' : '○ '}${label}${pin}${cfgEnabled ? '' : ' (disabled)'}`,
          variant: on ? 'glow' : 'gray',
          onClick: cfgEnabled ? () => onToggleRelay(Number(id)) : undefined,
        };
      }

      const on = enabledMap[String(id)] !== false;
      return {
        type: 'button',
        name: `__oa__${k}__${id}`,
        // 'disabled' is reserved by UiButton to block clicks — use 'gray' for the
        // off state so toggling stays interactive.
        label: `${on ? '● ' : '○ '}${label}${pin}`,
        variant: on ? 'glow' : 'gray',
        onClick: () => onToggleItem(fieldName, k, id),
      };
    })
  );

// Re-coerce a drafted value back to its original type.
export const coerce = (drafted: any, original: any): any => {
  if (typeof original === 'boolean') return Boolean(drafted);
  if (typeof original === 'number')  return Number(drafted);
  if (Array.isArray(original))       return Array.isArray(drafted) ? drafted : original;
  if (original !== null && typeof original === 'object') {
    try { return JSON.parse(String(drafted)); } catch { return drafted; }
  }
  return drafted;
};
