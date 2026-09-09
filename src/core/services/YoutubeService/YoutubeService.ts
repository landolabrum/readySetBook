import environment from "~/src/core/environment";
import ApiService from "../ApiService";
import IYoutubeService, {
  YoutubeDownloadState,
  YoutubeFinalizePayload,
  YoutubeStartPayload,
  YoutubeVariant,
} from "./IYoutubeService";

const PATH_REQUEST = "youtube/request";
const PATH_FINALIZE = "youtube/finalize";
const PATH_STATUS = "youtube";

export default class YoutubeService
  extends ApiService
  implements IYoutubeService {
  constructor() {
    super(environment.serviceEndpoints.home);
  }

  private normalizeVariant(raw: any): YoutubeVariant {
    return {
      resolution: raw?.resolution ?? raw?.quality ?? "",
      format: raw?.format ?? raw?.container ?? "",
      sizeMb: raw?.size_mb ?? raw?.sizeMb ?? raw?.size,
      label: raw?.label,
    };
  }

  private normalizeJob(raw: any): YoutubeDownloadState {
    const video = raw?.video ?? {};
    const download = raw?.download ?? {};
    const available = Array.isArray(video?.available)
      ? video.available.map((v: any) => this.normalizeVariant(v))
      : [];

    return {
      requestId: raw?.request_id ?? raw?.requestId ?? "",
      status: raw?.status ?? "unknown",
      progress: raw?.progress ?? 0,
      stripeId: raw?.stripe_id ?? raw?.stripeId ?? null,
      video: {
        title: video?.title ?? "YouTube download",
        sourceUrl: video?.source_url ?? video?.sourceUrl ?? "",
        durationSeconds: video?.duration_seconds ?? video?.durationSeconds,
        bestResolution: video?.best_resolution ?? video?.bestResolution,
        available,
        selected: video?.selected
          ? this.normalizeVariant(video.selected)
          : null,
      },
      download: {
        url: download?.url,
        estimatedSizeMb:
          download?.estimated_size_mb ?? download?.estimatedSizeMb,
      },
    };
  }

  public async requestDownload(
    payload: YoutubeStartPayload
  ): Promise<YoutubeDownloadState> {
    const res = await this.post<YoutubeStartPayload, any>(PATH_REQUEST, {
      url: payload.url,
      stripeId: payload.stripeId,
      label: payload.label,
    });
    return this.normalizeJob(res);
  }

  public async finalizeDownload(
    payload: YoutubeFinalizePayload
  ): Promise<YoutubeDownloadState> {
    const res = await this.post<YoutubeFinalizePayload, any>(
      PATH_FINALIZE,
      payload
    );
    return this.normalizeJob(res);
  }

  public async getStatus(requestId: string): Promise<YoutubeDownloadState> {
    const res = await this.get<any>(`${PATH_STATUS}/${requestId}`);
    return this.normalizeJob(res);
  }
}
