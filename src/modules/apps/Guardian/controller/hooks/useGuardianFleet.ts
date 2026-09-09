import { useEffect, useMemo, useState } from "react";
import { getService } from "@webstack/common";
import IMemberService from "~/src/core/services/MemberService/IMemberService";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import { buildLookupVessels } from "../../utils/lookupVessels";

const FLEET_POLL_MS = 30000;

/**
 * Polls /gps/fleet/locations while enabled (vesselScope === "fleet").
 * The backend scopes rows by clearance: admins (>= 12) get every geo'd
 * fleet device, everyone else only devices they own.
 */
const useGuardianFleet = ({ enabled }: { enabled: boolean }) => {
  const memberService = useMemo(() => getService<IMemberService>("IMemberService"), []);
  const [fleetRows, setFleetRows] = useState<any[]>([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      setFleetLoading(true);
      try {
        const res: any = await memberService.getFleetLocations();
        if (cancelled) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        setFleetRows(rows);
        setFleetError(null);
      } catch (err: any) {
        if (!cancelled) setFleetError(err?.message || "Unable to load fleet locations");
      } finally {
        inFlight = false;
        if (!cancelled) setFleetLoading(false);
      }
    };
    void poll();
    const id = setInterval(poll, FLEET_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, memberService]);

  const fleetVessels = useMemo<IVessel[]>(
    () =>
      fleetRows.flatMap((row) => {
        const [vessel] = buildLookupVessels([row]);
        if (!vessel) return [];
        const info = row?.deviceInfo || row?.device_info || {};
        return [
          {
            ...vessel,
            icon: "fa-server",
            className: ["guardian__marker", "guardian__marker--fleet", vessel.className]
              .filter(Boolean)
              .join(" "),
            meta: {
              ...vessel.meta,
              source: "fleet",
              hostKey: info.hostKey,
              role: info.role,
              deviceClass: info.deviceClass,
              geoSource: info.geoSource,
              ownerUserId: info.ownerUserId,
              lastMetricsAt: info.lastMetricsAt,
            },
          } as IVessel,
        ];
      }),
    [fleetRows]
  );

  return { fleetRows, fleetVessels, fleetLoading, fleetError };
};

export default useGuardianFleet;
