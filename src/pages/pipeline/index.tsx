import dynamic from "next/dynamic";

const PipelineOutputPage = dynamic(
    () => import("@/modules/apps/Pipeline/components/PipelineOutputPage/PipelineOutputPage"),
    { ssr: false }
);

export default PipelineOutputPage;
