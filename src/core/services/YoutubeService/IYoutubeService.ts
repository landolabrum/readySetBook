export type YoutubeVariant = {
  resolution: string;
  format: string;
  sizeMb?: number | null;
  label?: string;
};

export type YoutubeVideoMeta = {
  title?: string | null;
  sourceUrl: string;
  durationSeconds?: number | null;
  bestResolution?: string | null;
  available: YoutubeVariant[];
  selected?: YoutubeVariant | null;
};

export type YoutubeDownloadState = {
  requestId: string;
  status: string;
  progress?: number;
  stripeId?: string | null;
  video: YoutubeVideoMeta;
  download?: {
    url?: string | null;
    estimatedSizeMb?: number | null;
  };
};

export type YoutubeStartPayload = {
  url: string;
  stripeId?: string;
  label?: string;
};

export type YoutubeFinalizePayload = {
  requestId: string;
  resolution: string;
  format: string;
};

export default interface IYoutubeService {
  requestDownload(payload: YoutubeStartPayload): Promise<YoutubeDownloadState>;
  finalizeDownload(payload: YoutubeFinalizePayload): Promise<YoutubeDownloadState>;
  getStatus(requestId: string): Promise<YoutubeDownloadState>;
}
