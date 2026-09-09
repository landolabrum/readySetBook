// ISurveillanceService — camera list, snapshots, PTZ, HLS status & object
// detection for the surveillance/stream backend
// (mindburn/routes/views/home/stream/surveillance/mixins/*).
//
// URL builders (streamUrl/snapshotUrl/ptzPositionUrl) return strings for
// <img>/<video> src attributes and abortable fetches; the async methods issue
// authenticated requests through ApiService.

export interface ICameraInfo {
  apartalarmParm: { heightY: string; longX: string; startX: string; startY: string; type: string };
  audioParm: { sampleRate: string };
  basicInfo: { firmware: string; hardware: string; mac: string; model: string; type: string; wifidb: string };
  channelResquestResult: { audio: string; video: string };
  recordType: { type: string };
  sdParm: { capacity: string; detail: string; free: string; status: string };
  settingParm: { logSd: string; logUdisk: string; nightVision: string; osd: string; stateVision: string; telnet: string; tz: string };
  uDiskParm: { capacity: string; free: string; status: string };
  videoParm: { bitRate: string; fps: string; horizontalFlip: string; logo: string; resolution: string; time: string; type: string; verticalFlip: string };
}

export interface ICamera {
  audio: boolean;
  camera_info: ICameraInfo | null;
  connected: boolean;
  dtls: number;
  enabled: boolean;
  firmware_ver: string;
  hls_url: string;
  img_time: number | null;
  img_url: string | null;
  ip: string;
  is_2k: boolean;
  is_battery: boolean;
  mac: string;
  model_name: string;
  motion: boolean;
  motion_ts: number;
  name_uri: string;
  nickname: string;
  on_demand: boolean;
  p2p_type: number;
  parent_dtls: number;
  parent_mac: string;
  product_model: string;
  ptz_position?: { horizontal?: number; vertical?: number } | null;
  record: boolean;
  req_bitrate: number;
  req_frame_size: number;
  rtmp_url: string;
  rtsp_fw: boolean;
  rtsp_fw_enabled: boolean;
  rtsp_url?: string;
  snapshot_url: string;
  start_time: number;
  status: number;
  stream_auth?: boolean;
  substream: boolean;
  thumbnail: string;
  thumbnail_url: string;
  timezone_name: string;
  webrtc?: boolean;
  webrtc_url?: string;
  /** host_key of the wyze-bridge serving this cam (added by the merge). */
  bridge?: string;
}

/** Payload from GET /stream/cams. */
export interface ISurveillanceCams {
  available: number;
  enabled: number;
  total: number;
  cameras: Record<string, ICamera>;
  bridges?: Array<{ host_key: string; ip: string; ok: boolean; cameras: number; error?: string | null }>;
  wyze_error?: string;
}

export interface IDetection {
  label: string;
  confidence: number;
  bbox: number[];
}

export interface IDetectionResult {
  camera_id: string;
  timestamp: number;
  detections: IDetection[];
  frame_size: number[] | null;
  status: string;
}

/** GET /stream/hls.status — live HLS health for a cam. */
export interface IHlsStatus {
  id: string;
  ready: boolean;
  path: string | null;
  source: 'mediamtx' | 'wyze-bridge' | 'offline' | string;
  target?: string;
  reason?: string;
}

/** rtsp = live MJPEG (heavy, re-encoded per request), hls = MediaMTX proxy
 *  (audio, cheap), snapshot = cached still (cheapest — use for grids). */
export type StreamKind = 'rtsp' | 'hls' | 'snapshot';

export interface IStreamUrlOpts {
  fmt?: string;
  fps?: number;
  quality?: number;
  w?: number;
  h?: number;
}

export interface ISurveillanceService {
  // ── data (authenticated requests) ──
  listCameras(): Promise<ISurveillanceCams>;
  getCameraInfo(id: string): Promise<ICamera>;
  getDetections(id: string): Promise<IDetectionResult>;
  hlsStatus(id: string): Promise<IHlsStatus>;
  getPtz(id: string): Promise<any>;
  setPtzPosition(id: string, x: number, y: number, s?: number): Promise<any>;

  // ── URL builders (no request) ──
  streamBaseUrl(): string;
  streamUrl(id: string, kind?: StreamKind, opts?: IStreamUrlOpts): string;
  snapshotUrl(id: string, cacheBust?: number | string): string;
  ptzPositionUrl(id: string, x: number, y: number, s?: number): string;
}

export default ISurveillanceService;
