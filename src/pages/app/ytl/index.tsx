import dynamic from "next/dynamic";

const YoutubeDownloader = dynamic(
  () => import("@/modules/apps/YTL/controller/YoutubeDownloader"),
  { ssr: false }
);

export default YoutubeDownloader;
