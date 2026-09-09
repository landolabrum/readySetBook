export type GuardianViewMode = "live" | "timeline";

/** Vessel visibility scope. "fleet" = MindBurn fleet devices (system_hosts):
 * admins (clearance >= 12) see all, others only devices they own. */
export type GuardianVesselScope = "all" | "mine" | "fleet";

export type { GuardianFix, GuardianState, TrackerStatus } from "./tracker/types";
