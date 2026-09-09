import { STORAGE_KEYS } from "./types";
import { normalizeDeviceIdentifier, normalizeDeviceLabel } from "./helpers";

export type DeviceDescriptorShape = {
  id: string;
  label?: string;
  type?: string;
  info?: any;
};

const hashParts = (parts: (string | number | undefined)[]) => {
  const payload = parts.map((p) => (p == null ? "" : String(p))).join("|");
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16);
  return `fp-${hex}`;
};

const buildFingerprint = (nav: Navigator | undefined, scr: Screen | undefined): string => {
  const uaPlatform = (nav as any)?.userAgentData?.platform;
  const orientation = scr && "orientation" in scr ? (scr.orientation as any)?.type : undefined;
  const parts = [
    nav?.hardwareConcurrency,
    (nav as any)?.deviceMemory,
    scr?.width,
    scr?.height,
    typeof window !== "undefined" ? window.devicePixelRatio : undefined,
    scr?.colorDepth,
    orientation,
    nav?.vendor,
    uaPlatform || nav?.platform,
    nav?.maxTouchPoints,
  ];
  return hashParts(parts);
};

const randomId = () => `guardian-${Math.random().toString(36).slice(2, 10)}`;

export const buildDescriptor = (
  stored: any,
  nav: Navigator | undefined
): DeviceDescriptorShape => {
  const scr: Screen | undefined = typeof window !== "undefined" ? window.screen : undefined;
  const ua = nav?.userAgent || "";
  const fingerprint = buildFingerprint(nav, scr);
  const orientationType =
    scr && "orientation" in scr ? (scr.orientation as any)?.type : undefined;
  const storedId =
    typeof stored === "string"
      ? stored
      : stored?.deviceId || stored?.id || stored?.value;
  const id =
    normalizeDeviceIdentifier(storedId) ||
    normalizeDeviceIdentifier(fingerprint) ||
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : randomId());
  const type = stored?.deviceType || (/mobile/i.test(ua) ? "mobile" : "desktop");
  const label =
    normalizeDeviceLabel(stored?.deviceLabel || stored?.label) ||
    normalizeDeviceLabel((nav as any)?.userAgentData?.platform || nav?.platform) ||
    id;

  const info = {
    userAgent: ua,
    platform: nav?.platform,
    language: nav?.language,
    vendor: nav?.vendor,
    deviceId: id,
    deviceLabel: label,
    deviceType: type,
    deviceFingerprint: fingerprint,
    hardwareConcurrency: nav?.hardwareConcurrency,
    deviceMemory: (nav as any)?.deviceMemory,
    screenWidth: scr?.width,
    screenHeight: scr?.height,
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : undefined,
    colorDepth: scr?.colorDepth,
    orientationType,
    maxTouchPoints: nav?.maxTouchPoints,
  };

  return { id, label, type, info };
};

export const hydrateDescriptor = (
  getLocalItem?: (key: string) => any
): DeviceDescriptorShape | null => {
  if (!getLocalItem) return null;
  const stored = getLocalItem(STORAGE_KEYS.device);
  if (!stored) return null;
  const nav: Navigator | undefined =
    typeof navigator !== "undefined" ? navigator : undefined;
  return buildDescriptor(stored, nav);
};

export const persistDescriptor = (
  descriptor: DeviceDescriptorShape,
  setLocalItem?: (key: string, value: any) => void
) => {
  if (!setLocalItem) return;
  setLocalItem(STORAGE_KEYS.device, {
    deviceId: descriptor.id,
    deviceLabel: descriptor.label,
    deviceType: descriptor.type,
  });
};
