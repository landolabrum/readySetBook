import { useCallback, useEffect, useMemo } from "react";
import { useTeamGpsByVehicleNumber } from "@Canopy/hooks/useTeamGPS";
import type { CanonOverlay } from "@Canopy/models/canopyOverlayTypes";
import { coerceEnabled, jsonEq } from "@Canopy/models/canopyOverlayTypes";
import { toNum } from "../../../functions/overlayHelpers";
import type { TeamOption } from "../../../../../forms/CanopyTeamPicker/CanopyTeamPicker";
import type { OverlayPatch } from "../../../functions/overlayControlTypes";

type Args = {
  eventId?: string;
  displayOverlays: CanonOverlay[];
  roster: any[] | null | undefined;
  setOverlays: (next: any) => void;
  patch: OverlayPatch;
};

export const useOverlayRosterTeams = ({
  eventId,
  displayOverlays,
  roster,
  setOverlays,
  patch,
}: Args) => {
  const needsGps = useMemo(
    () => displayOverlays.some((o) =>
      (o.type === "scoreboard" || o.type === "map" || o.type === "hud" || o.type === "weather") &&
      coerceEnabled(o.enabled)
    ),
    [displayOverlays],
  );

  const rosterVehicles = useMemo(
    () => (needsGps ? (Array.isArray(roster) ? roster : []).map((r: any) => r?.vehicle_number ?? r?.number ?? r?.id).filter(Boolean).map(String) : []),
    [roster, needsGps],
  );

  const gps = useTeamGpsByVehicleNumber(needsGps ? eventId : undefined, rosterVehicles, 3000);

  const gpsSignature = useMemo(
    () => (gps && typeof gps.get === "function" ? rosterVehicles.map((v) => (gps.get(v) ? "1" : "0")).join("") : ""),
    [gps, rosterVehicles],
  );

  const rosterTeams = useMemo(() => {
    const list = Array.isArray(roster) ? [...roster] : [];
    list.sort((a: any, b: any) => {
      const as = toNum((a as any)?.score ?? 0);
      const bs = toNum((b as any)?.score ?? 0);
      if (as !== bs) return as - bs;
      const av = Number(String((a as any)?.vehicle_number ?? "").replace(/\D+/g, "")) || 0;
      const bv = Number(String((b as any)?.vehicle_number ?? "").replace(/\D+/g, "")) || 0;
      if (av !== bv) return av - bv;
      return String((a as any)?.team_name ?? "").localeCompare(String((b as any)?.team_name ?? ""));
    });

    return list.map((r: any, i: number) => ({
      id: r?.id != null ? Number(r.id) : undefined,
      name: r?.team_name,
      vehicle_number: r?.vehicle_number != null ? String(r.vehicle_number) : undefined,
      competitor: Array.isArray(r?.competitors) ? r.competitors[0]?.name ?? undefined : r?.competitor_name ?? undefined,
      competitors: Array.isArray(r?.competitors)
        ? r.competitors.map((c: any) => ({
          id: c?.id,
          name: c?.name ?? null,
          role: c?.role ?? null,
          position: typeof c?.position === "number" ? c.position : (c?.position != null ? Number(c.position) : null),
        }))
        : undefined,
      color: typeof r?.color === "string" ? r.color : undefined,
      place: i + 1,
      score: toNum(r?.score ?? 0) || undefined,
    }));
  }, [roster]);

  useEffect(() => {
    if (!rosterTeams.length) return;
    setOverlays((prev: CanonOverlay[]) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      let changed = false;
      const next = list.map((ov) => {
        if (ov?.type !== "scoreboard") return ov;
        const existingTeams = Array.isArray((ov as any)?.data?.teams) ? (ov as any).data.teams : [];
        if (jsonEq(existingTeams, rosterTeams)) return ov;
        changed = true;
        return { ...ov, data: { ...(ov as any)?.data, teams: rosterTeams } } as CanonOverlay;
      });
      return changed ? next : prev;
    });
  }, [rosterTeams, setOverlays]);

  const teamOptions: TeamOption[] = useMemo(() => {
    const rs = Array.isArray(roster) ? roster : [];
    return rs.map((r: any) => {
      const vehicle = String(r.vehicle_number ?? r.number ?? r.id ?? "");
      if (!vehicle) return null;
      const idx = rosterVehicles.indexOf(vehicle);
      return {
        id: String(r.id ?? r.team_id ?? vehicle),
        label: String(r.team_name ?? r.name ?? "Unnamed"),
        vehicle,
        hasGps: idx >= 0 && gpsSignature[idx] === "1",
      } as TeamOption;
    }).filter(Boolean) as TeamOption[];
  }, [roster, gpsSignature, rosterVehicles]);

  const toggleTeam = useCallback((overlay: CanonOverlay, veh: string) => {
    const arr = Array.isArray(overlay?.data?.team_numbers) ? overlay.data.team_numbers.map((x: any) => String(x)) : [];
    const set = new Set(arr);
    if (set.has(veh)) set.delete(veh); else set.add(veh);
    patch(overlay.id, overlay.type, "data.team_numbers", Array.from(set));
  }, [patch]);

  const selectAllTeams = useCallback((overlay: CanonOverlay) => {
    patch(overlay.id, overlay.type, "data.team_numbers", teamOptions.filter((o) => o.hasGps).map((o) => o.vehicle));
  }, [teamOptions, patch]);

  const clearTeams = useCallback((overlay: CanonOverlay) => {
    patch(overlay.id, overlay.type, "data.team_numbers", []);
  }, [patch]);

  return { teamOptions, toggleTeam, selectAllTeams, clearTeams };
};
