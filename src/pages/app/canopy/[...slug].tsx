import dynamic from "next/dynamic";

// Preserve legacy slug-based canopy paths (e.g., /app/canopy/media, /app/canopy/foo)
const CanopyMedia = dynamic(
  () =>
    import("@Canopy/receiver/pages/CanopyPage/controller/CanopyPage").then(
      (m) => m.default
    ),
  { ssr: false }
);

export default CanopyMedia;
