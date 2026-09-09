export const clamp01 = (n: any) => Math.min(100, Math.max(0, Number(n) || 0));

export const toFloatOrUndef = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const setDeep = <T extends Record<string, any>>(obj: T, path: string, value: any): T => {
  if (!path || path.indexOf(".") === -1) return { ...(obj as any), [path || "value"]: value };
  const parts = path.split(".");
  const last = parts.pop() as string;
  const root: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  let cursor = root;
  for (const key of parts) {
    const current = cursor[key];
    const next = Array.isArray(current) ? [...current] : { ...(current || {}) };
    cursor[key] = next;
    cursor = next;
  }
  cursor[last] = value;
  return root as T;
};

export const pickValue = (raw: any) =>
  raw && typeof raw === "object" && "value" in raw ? (raw as any).value : raw;

export const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const truncateLabel = (text: string, max = 28) => {
  const raw = text.trim();
  if (!raw) return "";
  return raw.length > max ? `${raw.slice(0, max - 3)}...` : raw;
};
