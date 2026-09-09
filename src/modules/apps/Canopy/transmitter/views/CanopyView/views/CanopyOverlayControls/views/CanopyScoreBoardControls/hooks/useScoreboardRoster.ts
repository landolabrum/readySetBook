import { useCallback, useRef, useState } from "react";
import { getService as getSvc } from "@webstack/common";
import type DBService from "~/src/core/services/DataBaseService/IDataBaseService";
import { useLiveStreamCtx } from "../../../../../../../../context/CanopyProvider";
import {
  coerceScore,
  normalizeRosterList,
  reflowScores,
  sortRoster,
  type RosterRow,
} from "../functions/scoreboardRosterUtils";

const apiBaseFromDb = () => {
  const db: any = getSvc<DBService>("IDataBaseService");
  return String(db?.baseUrl || db?.getBaseUrl?.() || process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
};

type Args = {
  currentId?: string | number;
};

export const useScoreboardRoster = ({ currentId }: Args) => {
  const db = getSvc<DBService>("IDataBaseService");
  const { loadRoster: refreshRoster } = useLiveStreamCtx();

  const [pageState, setPageState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[] | null>(null);

  const inflight = useRef<Promise<any> | null>(null);
  const inflightFor = useRef<string | null>(null);

  const overlayPing = useCallback(async (eventId: string | number | undefined) => {
    if (!eventId) return;
    const base = apiBaseFromDb();
    if (!base) return;
    try {
      await fetch(`${base}/db/overlay_ping?event_id=${encodeURIComponent(String(eventId))}`, {
        method: "POST",
        keepalive: true,
      });
    } catch {
      // non-fatal
    }
  }, []);

  const batchSaveScores = useCallback(async (writes: Array<{ id: string | number; score: number }>) => {
    if (!writes.length) return;
    try {
      await Promise.all(
        writes.map(({ id, score }) =>
          db.updateData({
            tableName: "event_team",
            set: { score },
            where: { exact: { id } },
          }).catch((e: any) => console.error("[LIVE STREAM] failed to update score for", id, e)),
        ),
      );

      if (currentId) {
        await refreshRoster(String(currentId), { force: true });
        try {
          window.dispatchEvent(new CustomEvent("canopy:roster-updated", { detail: { eventId: String(currentId) } }));
        } catch {
          // ignore
        }
      }
      await overlayPing(currentId);
    } catch (e) {
      console.error("[LIVE STREAM] batch save failed", e);
    }
  }, [db, currentId, refreshRoster, overlayPing]);

  const setScoreLocal = useCallback((teamId: string | number, desiredScore: number) => {
    const prevList = roster ?? [];
    const nextList = reflowScores(prevList, teamId, desiredScore);

    const pendingWrites: Array<{ id: string | number; score: number }> = [];
    nextList.forEach((nextRow) => {
      const prevRow = prevList.find((r) => String(r.id) === String(nextRow.id));
      if (!prevRow || coerceScore(prevRow.score) !== coerceScore(nextRow.score)) {
        pendingWrites.push({ id: nextRow.id!, score: coerceScore(nextRow.score) });
      }
    });

    setRoster(nextList);
    if (pendingWrites.length > 0) void batchSaveScores(pendingWrites);
  }, [roster, batchSaveScores]);

  const loadRoster = useCallback(async (eventId: string | number, { force = false }: { force?: boolean } = {}) => {
    if (!eventId) {
      setRoster(null);
      setPageState("loading");
      return;
    }
    const eid = String(eventId);
    if (inflight.current && inflightFor.current === eid && !force) return inflight.current;

    setPageState((prev: any) => (prev === "ready" && !force ? prev : "loading"));
    setErrorMsg(null);

    const p = (async () => {
      try {
        const res = await db.selectData({ tableName: "event_team", where: { exact: { event_id: eventId } } });
        const base = normalizeRosterList(res).map((r: RosterRow) => ({
          ...r,
          event_id: r.event_id,
          team_name: r.team_name ?? "",
          vehicle_number: r.vehicle_number != null ? String(r.vehicle_number) : null,
          score: coerceScore(r.score ?? 0),
        }));
        setRoster(sortRoster(base).map((r, i) => ({ ...r, score: i + 1 })));
        setPageState("ready");
      } catch (e: any) {
        console.error("[LIVE STREAM] loadRoster", e);
        setRoster([]);
        setPageState("error");
        setErrorMsg(e?.message ?? "Failed to load roster");
      } finally {
        inflight.current = null;
        inflightFor.current = null;
      }
    })();

    inflight.current = p;
    inflightFor.current = eid;
    return p;
  }, [db]);

  const onRowDrag = useCallback((e: { from: number; to: number; row?: { id?: string | number } }) => {
    const { from, to, row } = e;
    if (from === to) return;
    let movedId = row?.id;
    if (movedId == null) {
      const ordered = sortRoster(roster ?? []);
      movedId = ordered[from]?.id;
    }
    if (movedId == null) return;
    setScoreLocal(movedId, to + 1);
  }, [roster, setScoreLocal]);

  return {
    pageState,
    errorMsg,
    roster,
    setRoster,
    loadRoster,
    setScoreLocal,
    onRowDrag,
    refreshRoster,
    overlayPing,
  };
};
