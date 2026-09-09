export type TrackerStatus = "idle" | "requesting" | "tracking" | "error";

export type GuardianFix = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  displayTimestamp?: number;
  speedMph?: number;
  deviceInfo?: any;
  deviceId?: string;
  deviceLabel?: string;
  deviceType?: string;
  userId?: string;
  recordedAt?: number;
  recorded_at?: number;
};

export type DeviceDescriptor = {
  id: string;
  label?: string;
  type?: string;
  info?: any;
};

export type GuardianState = {
  tracking: boolean;
  status: TrackerStatus;
  permission?: "prompt" | "denied" | "granted";
  lastFix?: GuardianFix;
  lastBackendSync?: number;
  error?: string;
};

export const STORAGE_KEYS = {
  fix: "guardian:tracking:lastFix",
  device: "guardian:tracking:deviceId",
  upload: "guardian:tracking:uploadInterval",
};

export const LOCAL_TRACKING_STATE = "guardian:tracking:active";
export const STALE_FIX_MS = 15 * 60 * 1000;
export const MIN_BACKEND_DISTANCE_METERS = 1;
export const DEFAULT_UPLOAD_INTERVAL = 3;
export const UPLOAD_INTERVALS = [3];
