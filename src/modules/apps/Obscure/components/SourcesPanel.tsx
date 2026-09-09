import React, { useCallback, useMemo, useState } from "react";
import Obscurestyles from "../controller/Obscure.scss";
import AdapTable from "@webstack/components/AdapTable/views/AdapTable";
import { SourceRow } from "./types";
import { formatTime } from "../utils/time";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import ToggleSwitch from "@webstack/components/UiForm/components/UiToggle/UiToggle";

type SourcesPanelProps = {
  rows: SourceRow[];
  sceneName: string | null;
  loading: boolean;
  lastUpdated?: number;
  onRefresh: () => void;
  onSetVisible: (sceneItemId: number, visible: boolean) => Promise<void>;
  onSetLocked: (sceneItemId: number, locked: boolean) => Promise<void>;
  onReorder: (orderedSceneItemIds: number[]) => Promise<void>;
};

const SourceOverview: React.FC<{
  row: SourceRow;
  onSetVisible: (sceneItemId: number, visible: boolean) => Promise<void>;
  onSetLocked: (sceneItemId: number, locked: boolean) => Promise<void>;
}> = ({ row, onSetVisible, onSetLocked }) => {
  const [saving, setSaving] = useState<null | "visible" | "locked">(null);

  const handleVisibleChange = useCallback(
    async (e: any) => {
      const next = Boolean(e?.target?.value);
      setSaving("visible");
      try {
        await onSetVisible(row.sceneItemId, next);
      } finally {
        setSaving(null);
      }
    },
    [onSetVisible, row.sceneItemId]
  );

  const handleLockedChange = useCallback(
    async (e: any) => {
      const next = Boolean(e?.target?.value);
      setSaving("locked");
      try {
        await onSetLocked(row.sceneItemId, next);
      } finally {
        setSaving(null);
      }
    },
    [onSetLocked, row.sceneItemId]
  );

  return (
    <div className="obscure__modal-content">
      <div className="obscure__modal-kv">
        <div>
          <strong>source</strong>: {row.source}
        </div>
        <div>
          <strong>kind</strong>: {row.kind}
        </div>
        <div>
          <strong>input</strong>: {row.input}
        </div>
        <div>
          <strong>order</strong>: {row.order}
        </div>
      </div>

      <div className="obscure__modal-actions">
        <ToggleSwitch
          name="visible"
          label="Visible"
          value={row.visible}
          disabled={saving !== null}
          onChange={handleVisibleChange}
        />
        <ToggleSwitch
          name="locked"
          label="Locked"
          value={row.locked}
          disabled={saving !== null}
          onChange={handleLockedChange}
        />
      </div>
    </div>
  );
};

const SourcesPanel: React.FC<SourcesPanelProps> = ({
  rows,
  sceneName,
  loading,
  lastUpdated,
  onRefresh,
  onSetVisible,
  onSetLocked,
  onReorder,
}) => {
  const [search, setSearch] = useState("");
  const { openModal } = useModal();
  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const needle = search.toLowerCase();
    return rows.filter((row) =>
      [row.source, row.kind, row.input, row.visible, row.locked, row.order].some(
        (value) => String(value).toLowerCase().includes(needle)
      )
    );
  }, [rows, search]);

  const tableTitle = sceneName ? `Sources · ${sceneName}` : "Scene sources";

  const handleRowClick = useCallback(
    (row: SourceRow) => {
      openModal({
        title: `Source · ${row.source}`,
        children: (
          <SourceOverview row={row} onSetVisible={onSetVisible} onSetLocked={onSetLocked} />
        ),
      });
    },
    [onSetLocked, onSetVisible, openModal]
  );

  const handleDrag = useCallback(
    async (payload: any) => {
      if (search) return;
      const ordered = Array.isArray(payload?.data)
        ? payload.data
          .map((item: any) => Number(item?.sceneItemId))
          .filter((value: number) => Number.isFinite(value))
        : [];

      if (!ordered.length) return;
      if (payload?.from === payload?.to) return;
      await onReorder(ordered);
    },
    [onReorder, search]
  );

  return (
    <>
      <style jsx>{Obscurestyles}</style>
      <article className="obscure__panel obscure__panel--full">
        <header className="obscure__panel-head">
          <div>
            <h2>Sources</h2>
            <p>
              Monitoring {sceneName ?? "current scene"} ·
              <span> updated {formatTime(lastUpdated)}</span>
            </p>
          </div>
          <UiIcon icon={loading ? "spinner" : "fa-rotate"} onClick={onRefresh} aria-busy={loading} />
        </header>
        {!loading && rows?.length && (<AdapTable
          data={filteredRows}
          loading={loading}
          search={search}
          setSearch={setSearch}
          limit={10}
          onRowClick={handleRowClick}
          onDrag={handleDrag}
          options={{
            tableTitle,
            placeholder: "Search sources",
            hoverable: true,
            hideColumns: ["sceneItemId", "sourceUuid"],
          }}
        />)}
      </article>
    </>
  );
};

export default SourcesPanel;
