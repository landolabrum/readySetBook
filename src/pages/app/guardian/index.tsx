import dynamic from "next/dynamic";

const Guardian = dynamic(
  () => import("~/src/modules/apps/Guardian/controller/Guardian"),
  { ssr: false }
);

export default Guardian;
