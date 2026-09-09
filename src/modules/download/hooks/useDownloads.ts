import { useEffect, useState } from "react";
import { getService } from "@webstack/common";
import IDownloadService from "~/src/core/services/DownloadService/IDownloadService";
import { IDownloadTarget } from "../models/IDownloadTarget";

// Fetches the public download targets (3 device classes + build identity).
// Gating + token minting live in the page (reusing the paywall service);
// this hook is intentionally read-only and secret-free.
export const useDownloads = () => {
  const service = getService<IDownloadService>("IDownloadService");
  const [targets, setTargets] = useState<IDownloadTarget[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const t = await service.getTargets();
        if (active) setTargets(t);
      } catch (e: any) {
        if (active) setError(e?.message || "Failed to load download targets.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { targets, loading, error };
};

export default useDownloads;
