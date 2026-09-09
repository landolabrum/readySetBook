import { useCallback, useEffect, useMemo, useState } from "react";
import stylesControls from "./CanopyScoreBoardControls.scss";
import AdapTable from "@webstack/components/AdapTable/views/AdapTable";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import AdminLiveStreamEditTeam from "../../../../../../forms/CanopyTeamForm/CanopyTeamForm";
import UiPill from "@webstack/components/UiForm/components/UiPill/UiPill";
import { coerceScore, sortRoster, type RosterRow } from "./functions/scoreboardRosterUtils";
import { useScoreboardRoster } from "./hooks/useScoreboardRoster";

type Props = { current: { id: string; name: string } | null };
const KEY = "Roster";

export const CanopyScoreBoardControls: React.FC<Props> = ({ current }) => {
  const { openModal, closeModal } = useModal();
  const [editMode, setEditMode] = useState(false);
  const {
    pageState,
    errorMsg,
    roster,
    loadRoster,
    setScoreLocal,
    onRowDrag,
    refreshRoster,
    overlayPing,
  } = useScoreboardRoster({ currentId: current?.id });

  const handleAddTeamModal = useCallback(() => {
    openModal({
      title: `Add Team • ${current?.name ?? ""}`,
      children: (
        <AdminLiveStreamEditTeam
          team={null}
          eventId={current?.id}
          onUpdated={async () => {
            closeModal();
            if (current?.id) {
              await loadRoster(current.id, { force: true });
              await refreshRoster(String(current.id), { force: true });
              await overlayPing(current.id);
            }
          }}
        />
      ),
    });
  }, [openModal, closeModal, current?.id, current?.name, loadRoster, refreshRoster, overlayPing]);

  const handleEditTeamModal = useCallback((team: RosterRow) => {
    openModal({
      title: `Edit Team: ${team.team_name}`,
      children: (
        <AdminLiveStreamEditTeam
          team={team}
          eventId={current?.id}
          onUpdated={async () => {
            closeModal();
            if (current?.id) {
              await loadRoster(current.id, { force: true });
              await refreshRoster(String(current.id), { force: true });
              await overlayPing(current.id);
            }
          }}
        />
      ),
    });
  }, [openModal, closeModal, current?.id, loadRoster, refreshRoster, overlayPing]);

  const onRowClick = useCallback((arg: MouseEvent | { id: string | number }) => {
    let rowKey: string | undefined;
    if (typeof arg === "string") rowKey = arg;
    else if (arg && typeof arg === "object" && "id" in arg) rowKey = (arg as any).id?.toString();
    else if (arg && "target" in arg) {
      let el: HTMLElement | null = (arg as MouseEvent).target as HTMLElement;
      while (el && !rowKey) {
        rowKey = el.dataset?.rowkey;
        el = el.parentElement;
      }
    }
    if (!rowKey) return;
    const teamToEdit = roster?.find((team) => String(team.id) === rowKey);
    if (teamToEdit) handleEditTeamModal(teamToEdit);
  }, [roster, handleEditTeamModal]);

  const rosterTableData = useMemo(() => {
    if (!roster) return null;
    return sortRoster(roster).map((f: RosterRow) => {
      const val = coerceScore(f.score ?? 0);
      const compLine = Array.isArray(f.competitors) && f.competitors.length > 0
        ? f.competitors.filter((c) => c && (c.name || c.role)).map((c) => `${c.role || "Competitor"}: ${c.name ?? ""}`).join("  |  ")
        : "";
      return {
        [KEY]: (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span>{f.team_name || "(unnamed team)"}</span>
            {compLine ? <span style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{compLine}</span> : null}
          </div>
        ),
        number: f.vehicle_number != null ? String(f.vehicle_number) : "",
        score: (
          <div className="d-flex s-w-100 justify-end" key={`pill-wrap-${f.id}`} onClick={(e) => e.stopPropagation()}>
            <UiPill variant="rank" amount={val} setAmount={(next: number) => setScoreLocal(f.id!, next)} />
          </div>
        ),
        edit: (
          <div className="d-flex justify-end" key={`edit-${f.id}`} onClick={(e) => e.stopPropagation()}>
            <UiButton
              size="xs"
              variant="flat"
              traits={{ afterIcon: "fa-pen-to-square" }}
              onClick={() => handleEditTeamModal(f)}
            >
              Edit
            </UiButton>
          </div>
        ),
        id: f.id,
      };
    });
  }, [roster, setScoreLocal, handleEditTeamModal]);

  useEffect(() => {
    if (current?.id) void loadRoster(current.id, { force: true });
  }, [current?.id, loadRoster]);

  const tableTitle = useMemo(() => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8 }}>
      <span>Roster{current?.name ? ` · ${current.name}` : ""}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <UiButton
          onClick={() => setEditMode((s) => !s)}
          variant={editMode ? "primary" : "flat"}
          traits={{ afterIcon: editMode ? "fa-xmark" : "fa-pen-to-square" }}
        >
          {editMode ? "Done" : "Edit Teams"}
        </UiButton>
        <UiButton onClick={handleAddTeamModal} variant="link" traits={{ afterIcon: "fa-user-group" }}>
          Add Team
        </UiButton>
      </div>
    </div>
  ), [current?.name, handleAddTeamModal, editMode]);

  return (
    <>
      <style jsx>{stylesControls}</style>
      <div className="admin-live-stream-controls">
        <div className="admin-live-stream-controls__section">
          {pageState === "loading" && "No event, or still loading"}
          {pageState === "error" && <div role="alert">Error: {errorMsg}</div>}
          {pageState === "ready" && rosterTableData ? (
            <AdapTable
              data={rosterTableData}
              onRowClick={onRowClick}
              onDrag={onRowDrag}
              options={{ tableTitle, hideColumns: editMode ? ["id"] : ["id", "edit"] }}
            />
          ) : null}
        </div>
      </div>
    </>
  );
};
