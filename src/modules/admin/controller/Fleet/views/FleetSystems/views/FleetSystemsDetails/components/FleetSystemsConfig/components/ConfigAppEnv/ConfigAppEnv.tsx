// Editable JSONB key-value table for system_hosts.app_env. Drives a single
// PATCH whose payload is the merged JSON (additions, edits and deletions).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './ConfigAppEnv.scss';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { objToSortedRows } from '../../../../../../helpers/draftRows';

interface Props {
  config: any | null;
  saving: boolean;
  onSave: (patch: Record<string, any>) => Promise<void>;
}

type Row = { key: string; value: string };

const toRows = (env: any): Row[] =>
  objToSortedRows(env, (key, v) => ({ key, value: v == null ? '' : String(v) }));

const rowsEqual = (a: Row[], b: Row[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].key !== b[i].key || a[i].value !== b[i].value) return false;
  }
  return true;
};

const ConfigAppEnv: React.FC<Props> = ({ config, saving, onSave }) => {
  const initial = useMemo(() => toRows(config?.app_env ?? {}), [config]);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => { setRows(initial); }, [initial]);

  const dirty = !rowsEqual(initial, rows);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.key.toLowerCase().includes(q) || r.value.toLowerCase().includes(q));
  }, [rows, filter]);

  const handleChange = useCallback((idx: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const handleDelete = useCallback((idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleAdd = useCallback(() => {
    setRows(prev => [...prev, { key: '', value: '' }]);
  }, []);

  const handleReset = useCallback(() => { setRows(initial); }, [initial]);

  const handleSave = useCallback(async () => {
    const next: Record<string, string> = {};
    for (const r of rows) {
      const k = r.key.trim();
      if (!k) continue;
      next[k] = r.value;
    }
    await onSave({ app_env: next });
  }, [rows, onSave]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className="config-app-env">
        <div className="config-app-env__toolbar">
          <input
            type="text"
            className="config-app-env__filter"
            placeholder={`filter ${initial.length} keys…`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className="config-app-env__count">
            {visible.length}/{rows.length}
            {dirty && <em> (unsaved)</em>}
          </span>
        </div>

        <div className="config-app-env__table">
          {visible.map((r) => {
            const idx = rows.indexOf(r);
            return (
              <div key={`${idx}-${r.key}`} className="config-app-env__row">
                <input
                  type="text"
                  className="config-app-env__key"
                  value={r.key}
                  placeholder="KEY_NAME"
                  onChange={(e) => handleChange(idx, { key: e.target.value })}
                />
                <input
                  type="text"
                  className="config-app-env__value"
                  value={r.value}
                  placeholder="value"
                  onChange={(e) => handleChange(idx, { value: e.target.value })}
                />
                <button
                  type="button"
                  className="config-app-env__remove"
                  title="Remove"
                  onClick={() => handleDelete(idx)}
                >
                  <UiIcon icon="fa-trash-can" />
                </button>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="config-app-env__empty">No keys yet.</div>
          )}
        </div>

        <div className="config-app-env__actions">
          <UiButton onClick={handleAdd}>Add key</UiButton>
          <UiButton variant="ghost" disabled={!dirty} onClick={handleReset}>Reset</UiButton>
          <UiButton busy={saving} disabled={!dirty} onClick={handleSave}>
            {dirty ? 'Save app_env' : 'Saved'}
          </UiButton>
        </div>
      </div>
    </>
  );
};

export default ConfigAppEnv;
