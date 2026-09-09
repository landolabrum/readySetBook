import { useCallback, useMemo, useState } from "react";
import { getService } from "@webstack/common";
import IMemberService from "~/src/core/services/MemberService/IMemberService";
import IYoutubeService, {
  YoutubeDownloadState,
  YoutubeVariant,
} from "~/src/core/services/YoutubeService/IYoutubeService";
import { useEffect } from "react";

export type RequestStatus =
  | "idle"
  | "validating"
  | "processing"
  | "downloading"
  | "ready"
  | "error";

export type YoutubeUiState = {
  status: RequestStatus;
  progress: number;
  message?: string | null;
  error?: string | null;
  job?: YoutubeDownloadState;
  variantLoading?: string | null;
  downloadReady?: boolean;
};

const baseState: YoutubeUiState = {
  status: "idle",
  progress: 0,
  message: null,
  error: null,
  variantLoading: null,
  downloadReady: false,
};

const keyForVariant = (variant: YoutubeVariant): string =>
  `${variant.resolution}-${variant.format}`;

export function useYoutube() {
  const youtubeService = useMemo(
    () => getService<IYoutubeService>("IYoutubeService"),
    []
  );
  const memberService = useMemo(
    () => getService<IMemberService>("IMemberService"),
    []
  );

  const [url, setUrl] = useState("");
  const [state, setState] = useState<YoutubeUiState>(baseState);
  const [stripeId, setStripeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const user = memberService?.getCurrentUser?.();
    const guest = memberService?.getCurrentGuest?.();
    const id = user?.id || guest?.id;
    const resolved = id && id.startsWith("cus_") ? id : undefined;
    setStripeId(resolved);
  }, [memberService]);

  const submitUrl = useCallback(
    async (nextUrl?: string) => {
      const target = (nextUrl ?? url).trim();
      if (!target) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Paste a YouTube share link to begin.",
        }));
        return;
      }
      
      // Validate YouTube URL format
      const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/;
      if (!youtubePattern.test(target)) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Please enter a valid YouTube URL.",
        }));
        return;
      }
      
      setState((prev) => ({
        ...prev,
        status: "validating",
        progress: Math.max(prev.progress, 10),
        message: "Validating link and preparing stream map.",
        error: null,
      }));
      try {
        const job = await youtubeService.requestDownload({
          url: target,
          stripeId,
        });
        setState((prev) => ({
          ...prev,
          status: "processing",
          progress: job.progress ?? Math.max(prev.progress, 28),
          message: "Resolving resolutions and estimating size.",
          job,
          downloadReady: false,
        }));
        setUrl(target);
      } catch (err: any) {
        const detail =
          err?.detail || err?.message || "Could not start the download.";
        setState((prev) => ({
          ...prev,
          status: "error",
          error: detail,
          progress: prev.progress || 0,
        }));
      }
    },
    [stripeId, url, youtubeService]
  );

  const verifyDownloadUrl = useCallback(
    async (job?: YoutubeDownloadState, attempt = 1): Promise<boolean> => {
      const link = job?.download?.url;
      if (!link) {
        setState((prev) => ({ ...prev, downloadReady: false }));
        return false;
      }
      try {
        const res = await fetch(link, { method: "HEAD" });
        if (res.status == 202) {
          setState((prev) => ({
            ...prev,
            downloadReady: false,
            message: `File is staging—retrying (attempt ${attempt}/5)...`,
          }));
          if (attempt < 5) {
            // Exponential backoff: 2s, 4s, 6s, 8s
            setTimeout(() => {
              verifyDownloadUrl(job, attempt + 1);
            }, 2000 * attempt);
          } else {
            setState((prev) => ({
              ...prev,
              status: "error",
              error: "File staging timeout. Please try again later.",
              downloadReady: false,
            }));
          }
          return false;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setState((prev) => ({
          ...prev,
          downloadReady: true,
          status: "ready",
          message: "Download ready.",
          error: null,
        }));
        return true;
      } catch {
        setState((prev) => ({
          ...prev,
          downloadReady: false,
          message: "File is staging—retrying shortly.",
        }));
        if (attempt < 3) {
          setTimeout(() => {
            verifyDownloadUrl(job, attempt + 1);
          }, 1200);
        }
        return false;
      }
    },
    []
  );

  const refreshStatus = useCallback(async () => {
    const requestId = state.job?.requestId;
    if (!requestId) return;
    try {
      const job = await youtubeService.getStatus(requestId);
      setState((prev) => ({
        ...prev,
        job,
        status: job.status === "ready" ? "ready" : prev.status,
        progress: Math.max(prev.progress, job.progress ?? 0),
        downloadReady: prev.downloadReady,
      }));
      if (job.download?.url) {
        await verifyDownloadUrl(job);
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err?.message || "Unable to refresh status.",
      }));
    }
  }, [state.job?.requestId, verifyDownloadUrl, youtubeService]);

  const selectVariant = useCallback(
    async (variant: YoutubeVariant) => {
      const requestId = state.job?.requestId;
      if (!requestId) return;
      const variantKey = keyForVariant(variant);
      setState((prev) => ({
        ...prev,
        status: "downloading",
        variantLoading: variantKey,
        message: "Packaging your selection for download.",
        progress: Math.max(prev.progress, 92),
        downloadReady: false,
      }));
      try {
        const job = await youtubeService.finalizeDownload({
          requestId,
          resolution: variant.resolution,
          format: variant.format,
        });
        setState((prev) => ({
          ...prev,
          job,
          status: "ready",
          variantLoading: null,
          message: "Download ready.",
          progress: 100,
          error: null,
          downloadReady: false,
        }));
        await verifyDownloadUrl(job);
      } catch (err: any) {
        const detail =
          err?.detail || err?.message || "Unable to package this version.";
        setState((prev) => ({
          ...prev,
          status: "error",
          variantLoading: null,
          error: detail,
        }));
      }
    },
    [state.job?.requestId, verifyDownloadUrl, youtubeService]
  );

  const reset = useCallback(() => {
    setState(baseState);
    setUrl("");
  }, []);

  return {
    url,
    setUrl,
    state,
    stripeId,
    submitUrl,
    selectVariant,
    refreshStatus,
    reset,
    verifyDownloadUrl,
  };
}
