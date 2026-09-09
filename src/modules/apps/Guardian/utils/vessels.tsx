import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import { buildLookupVessels } from "./lookupVessels";
import { buildLiveVessels } from "./liveVessels";
import { buildTimelineVessels } from "./timelineVessels";
import { dedupeVessels, buildVesselKey } from "./vesselKeys";

export { buildLookupVessels, buildLiveVessels, buildTimelineVessels, dedupeVessels, buildVesselKey };

export const selectGuardianVessels = (
  viewMode: "live" | "timeline",
  timelineVessels: IVessel[],
  liveVessels: IVessel[]
): IVessel[] => {
  if (viewMode === "timeline") {
    return timelineVessels.length ? timelineVessels : liveVessels;
  }
  return liveVessels;
};
