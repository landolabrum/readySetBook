/** Numeric coercion — returns `d` when `v` is non-finite or non-numeric. @internal */
export const toNum = (v: unknown, d = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Clamp `n` to [min, max]. @internal */
export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/** Coerce any truthy/falsy-ish value to a boolean enabled flag. */
export const coerceEnabled = (raw: unknown): boolean => {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 'y'].includes(t)) return true;
    if (['false', '0', 'no', 'off', 'n', ''].includes(t)) return false;
  }
  return false;
};

/** Stable JSON serialisation (bigint-safe). Returns '' on error. */
export const jsonStable = (v: unknown): string => {
  try {
    return JSON.stringify(v, (_k, val) =>
      typeof val === 'bigint' ? String(val) : val,
    );
  } catch {
    return '';
  }
};

/** Deep-equality via stable JSON. Returns false on serialisation error. */
export const jsonEq = (a: unknown, b: unknown): boolean => {
  try {
    return jsonStable(a) === jsonStable(b);
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Field-builder string/number helpers (shared across all field builder files)
// ---------------------------------------------------------------------------

/** Coerce to string; null/undefined → ''. @internal */
export const _s = (v: unknown): string =>
  v == null ? '' : typeof v === 'string' ? v : String(v);

/** Coerce to finite number; non-finite → d (default 0). @internal */
export const _n = (v: unknown, d = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Coerce to finite number or undefined. @internal */
export const _toFloatOrUndef = (v: any): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
