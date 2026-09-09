// Relative Path: ./GodDataBaseDeleteTable.tsx
import React, { useMemo, useState } from 'react';
import styles from './GodDataBaseDeleteTable.scss';
import { getService } from '@webstack/common';
import IDataBaseService from '~/src/core/services/DataBaseService/IDataBaseService';

// Optional: if you have UiForm bits handy, you can replace the simple inputs below.
// Keeping it minimal & dependency-light here.

export interface SystemsAdminDatabaseDeleteTableProps {
  tableName: string | null;
  schema?: string | null;
  /** Called after a successful deletion; parent can reload tables/selection. */
  onDeleted?: (tableName: string) => void;
  /** Optional: disable when no table is selected (default true) */
  disabledWhenNoSelection?: boolean;
}

const SystemsAdminDatabaseDeleteTable: React.FC<SystemsAdminDatabaseDeleteTableProps> = ({
  tableName,
  schema = null,
  onDeleted,
  disabledWhenNoSelection = true,
}) => {
  const db = useMemo(() => getService<IDataBaseService>('IDataBaseService'), []);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canDelete =
    Boolean(tableName) &&
    confirmText.trim() === (tableName ?? '') &&
    !busy;

  const handleDelete = async () => {
    if (!tableName || !canDelete) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      // Prefer a clear method name on the service:
      // dropTable(tableName: string, schema?: string|null)
      await db.dropTable({ tableName});
      setOk(`Table "${tableName}" dropped.`);
      setConfirmText('');
      onDeleted?.(tableName);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to drop table.');
    } finally {
      setBusy(false);
    }
  };

  const disabled =
    (disabledWhenNoSelection && !tableName) || busy;

  return (
    <>
      <style jsx>{styles}</style>
      <div className="sysdb-del">
        <div className="sysdb-del__head">
          <h3>Delete Table</h3>
          <p className="sysdb-del__hint">
            This is destructive and cannot be undone.
          </p>
        </div>

        <div className="sysdb-del__meta">
          <div className="sysdb-del__row">
            <span className="sysdb-del__label">Schema</span>
            <span className="sysdb-del__value">{schema ?? 'default'}</span>
          </div>
          <div className="sysdb-del__row">
            <span className="sysdb-del__label">Table</span>
            <span className="sysdb-del__value">{tableName ?? '—'}</span>
          </div>
        </div>

        <div className="sysdb-del__confirm">
          <label className="sysdb-del__label">
            Type the table name to confirm
          </label>
          <input
            className="sysdb-del__input"
            placeholder={tableName ?? 'table_name'}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={disabled}
          />
        </div>

        {err && <div className="sysdb-del__error">Error: {err}</div>}
        {ok && <div className="sysdb-del__ok">{ok}</div>}

        <div className="sysdb-del__actions">
          <button
            className={`sysdb-del__btn sysdb-del__btn--danger ${!canDelete ? 'is-disabled' : ''}`}
            onClick={handleDelete}
            disabled={!canDelete}
            title={!tableName ? 'No table selected' : 'Drop table'}
          >
            {busy ? 'Deleting…' : 'Delete table'}
          </button>
        </div>
      </div>
    </>
  );
};

export default SystemsAdminDatabaseDeleteTable;
