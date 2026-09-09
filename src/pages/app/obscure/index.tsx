import dynamic from "next/dynamic";

const Obscure = dynamic(
  () => import("@/modules/apps/Obscure/controller/Obscure"),
  { ssr: false }
);

export default Obscure;
