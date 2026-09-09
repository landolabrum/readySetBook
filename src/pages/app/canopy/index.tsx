import dynamic from "next/dynamic";

const Canopy = dynamic(() => import("@Canopy/transmitter/controller/Canopy"), {
  ssr: false,
});

export default Canopy;
