import ApiService from "../ApiService";
import environment from "~/src/core/environment";
import { getService } from "@webstack/common";
import IMemberService from "../MemberService/IMemberService";
import ISurveillanceService, {
  ICamera,
  IDetectionResult,
  IHlsStatus,
  ISurveillanceCams,
  IStreamUrlOpts,
  StreamKind,
} from "./ISurveillanceService";

/** Same base every stream consumer must use. `serviceEndpoints.home` already
 *  resolves API_BASE (dev) / PRODUCTION_SERVER (prod) / same-origin — reading
 *  process.env directly (as some callers used to) is empty in dev and breaks
 *  <img>/<video> srcs. */
const resolveStreamBase = (): string =>
  (
    environment?.serviceEndpoints?.home ||
    (typeof window !== "undefined" ? window.location?.origin : "") ||
    ""
  ).replace(/\/$/, "");

export default class SurveillanceService extends ApiService implements ISurveillanceService {
  private MemberService: IMemberService;
  private base: string;

  constructor() {
    const base = resolveStreamBase();
    super(base);
    this.base = base;
    this.MemberService = getService<IMemberService>("IMemberService");
  }

  // ── data ────────────────────────────────────────────────────────────────
  public listCameras(): Promise<ISurveillanceCams> {
    return this.get<ISurveillanceCams>("/stream/cams");
  }

  public getCameraInfo(id: string): Promise<ICamera> {
    return this.get<ICamera>(`/stream/cam?id=${encodeURIComponent(id)}`);
  }

  public getDetections(id: string): Promise<IDetectionResult> {
    return this.get<IDetectionResult>(`/stream/detections?id=${encodeURIComponent(id)}`);
  }

  public hlsStatus(id: string): Promise<IHlsStatus> {
    return this.get<IHlsStatus>(`/stream/hls.status?id=${encodeURIComponent(id)}`);
  }

  public getPtz(id: string): Promise<any> {
    return this.get<any>(`/stream/ptz?id=${encodeURIComponent(id)}`);
  }

  public setPtzPosition(id: string, x: number, y: number, s?: number): Promise<any> {
    return this.get<any>(this.ptzPositionPath(id, x, y, s));
  }

  // ── URL builders (no request) ─────────────────────────────────────────────
  public streamBaseUrl(): string {
    return this.base;
  }

  public streamUrl(id: string, kind: StreamKind = "hls", opts: IStreamUrlOpts = {}): string {
    const cid = encodeURIComponent(id);
    if (kind === "snapshot") return `${this.base}/stream/img?id=${cid}`;
    if (kind === "hls") return `${this.base}/stream/hls.m3u8?id=${cid}`;
    // rtsp → live MJPEG multipart
    const q = new URLSearchParams({ id });
    if (opts.fmt) q.set("fmt", opts.fmt);
    if (opts.fps != null) q.set("fps", String(opts.fps));
    if (opts.quality != null) q.set("quality", String(opts.quality));
    if (opts.w != null) q.set("w", String(opts.w));
    if (opts.h != null) q.set("h", String(opts.h));
    return `${this.base}/stream/rtsp?${q.toString()}`;
  }

  /** Cached still. Pass a changing `cacheBust` (e.g. a tick counter) to refresh
   *  a grid tile without holding a live decode open on the server. */
  public snapshotUrl(id: string, cacheBust?: number | string): string {
    const url = this.streamUrl(id, "snapshot");
    return cacheBust != null ? `${url}&t=${cacheBust}` : url;
  }

  public ptzPositionUrl(id: string, x: number, y: number, s?: number): string {
    return `${this.base}${this.ptzPositionPath(id, x, y, s)}`;
  }

  private ptzPositionPath(id: string, x: number, y: number, s?: number): string {
    return `/stream/ptz_position?id=${encodeURIComponent(id)}&x=${x}&y=${y}${s ? `&s=${s}` : ""}`;
  }

  protected appendHeaders(headers: { [key: string]: string }) {
    super.appendHeaders(headers);
    const token = this.MemberService.getCurrentUserToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
}
