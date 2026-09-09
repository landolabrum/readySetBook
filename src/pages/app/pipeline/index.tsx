import dynamic from "next/dynamic";

const PipelinePage = dynamic(
  () => import("@/modules/apps/Pipeline/controller/Pipeline"),
  { ssr: false }
);

export default PipelinePage;
