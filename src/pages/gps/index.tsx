import dynamic from "next/dynamic";

const GuardianGps = dynamic(
  () => import("~/src/modules/apps/Guardian/controller/GuardianGps"),
  { ssr: false }
);

export default GuardianGps;
