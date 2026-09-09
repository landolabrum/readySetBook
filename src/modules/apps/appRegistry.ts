import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export type AppKey = "canopy" | "guardian" | "ytl" | "obscure" | (string & {});

export type AppDefinition = {
  key: string;
  label: string;
  href: string;
  description?: string;
  icon?: string;
};

// Map of available app components. Keep the dynamic instances stable to avoid
// recreating components between renders.
const canopyMain = dynamic(() => import("@Canopy/transmitter/controller/Canopy"), {
  ssr: false,
});
const canopyMedia = dynamic(
  () =>
    import("@Canopy/receiver/pages/CanopyPage/controller/CanopyPage").then(
      (m) => m.default
    ),
  { ssr: false }
);

const appComponents: Record<string, ComponentType<any>> = {
  canopy: canopyMain,
  guardian: dynamic(() => import("~/src/modules/apps/Guardian/controller/Guardian"), {
    ssr: false,
  }),
  ytl: dynamic(
    () => import("@/modules/apps/YTL/controller/YoutubeDownloader"),
    { ssr: false }
  ),
  obscure: dynamic(
    () => import("@/modules/apps/Obscure/controller/Obscure"),
    { ssr: false }
  ),
};

export const appCatalog: AppDefinition[] = [
  {
    key: "canopy",
    label: "Canopy",
    href: "/app/canopy",
    description: "Livestream overlays, events, and media controls.",
    icon: "fa-broadcast-tower",
  },
  {
    key: "guardian",
    label: "Guardian",
    href: "/app/guardian",
    description: "Security and monitoring tools.",
    icon: "fa-shield",
  },
  {
    key: "ytl",
    label: "Youtube Downloader",
    href: "/app/ytl",
    description: "Download videos from Youtube.",
    icon: "fa-youtube",
  },
  {
    key: "obscure",
    label: "Obscure",
    href: "/app/obscure",
    description: "OBS scene programming and transport controls.",
    icon: "fa-video",
  },

];

export const getAppComponent = (key?: string, slug?: string[] | string) => {
  if (!key) return undefined;
  const normalized = key.toLowerCase();
  if (normalized === "canopy") {
    // Legacy /apps[/slug] routes map to the media overlay; keep slug-based
    // canopy paths pointed there to avoid regressions.
    const slugParts = Array.isArray(slug)
      ? slug
      : slug
        ? [slug]
        : [];
    if (slugParts.length > 0) return canopyMedia;
  }
  return appComponents[normalized];
};
