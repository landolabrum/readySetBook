// Per-host secrets editor. The DB returns each value as
// `{has, length, hint}` (masked). This component lets the operator:
//   * Add a new secret (key + value)
//   * Reveal an existing secret (calls /system/hosts/{key}/secrets/{name})
//   * Replace a secret (sets a new plaintext value, then re-saves)
//   * Delete a secret
// Save commits the merged secrets JSONB via the standard PATCH route.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './ConfigSecrets.scss';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { objToSortedRows } from '../../../../../../helpers/draftRows';

type SecretMeta = { has: boolean; length: number; hint: string };
type DraftRow = {
  key: string;
  meta?: SecretMeta;
  // When set, replaces the on-disk value at save-time.
  pending?: string;
  // When true, will be removed at save-time.
  removed?: boolean;
  // Plaintext value once the user clicks "reveal".
  revealed?: string;
  // True while a reveal is in-flight.
  revealing?: boolean;
};

interface Props {
  hostKey: string;
  config: any | null;
  saving: boolean;
  onSave: (patch: Record<string, any>) => Promise<void>;
  onReveal: (hostKey: string, secretKey: string) => Promise<string | null>;
}

const toRows = (secrets: any): DraftRow[] =>
  objToSortedRows(secrets, (key, meta) => ({ key, meta: meta as SecretMeta }));

const ConfigSecrets: React.FC<Props> = ({ hostKey, config, saving, onSave, onReveal }) => {
  const initial = useMemo(() => toRows(config?.secrets ?? {}), [config]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  useEffect(() => { setRows(initial); }, [initial]);

  const dirty =
    rows.some(r => r.removed || r.pending !== undefined) ||
    newKey.trim() !== '';

  const updateRow = useCallback((idx: number, patch: Partial<DraftRow>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const handleReveal = useCallback(async (idx: number) => {
    const r = rows[idx];
    if (!r) return;
    updateRow(idx, { revealing: true });
    const value = await onReveal(hostKey, r.key);
    updateRow(idx, { revealing: false, revealed: value ?? '' });
  }, [rows, onReveal, hostKey, updateRow]);

  const handleHide = useCallback((idx: number) => {
    updateRow(idx, { revealed: undefined });
  }, [updateRow]);

  const handleEdit = useCallback((idx: number, value: string) => {
    updateRow(idx, { pending: value });
  }, [updateRow]);

  const handleRemove = useCallback((idx: number) => {
    updateRow(idx, { removed: !rows[idx]?.removed });
  }, [rows, updateRow]);

  const handleAdd = useCallback(() => {
    const k = newKey.trim();
    if (!k) return;
    setRows(prev => [...prev, { key: k, pending: newVal, meta: { has: false, length: 0, hint: '' } }]);
    setNewKey('');
    setNewVal('');
  }, [newKey, newVal]);

  const handleSave = useCallback(async () => {
    // Build the full secrets blob: existing keys keep their on-disk value
    // (we represent this with the sentinel `__keep__`), and the backend
    // merges any string values atop the existing JSONB. To keep the
    // backend simple we instead need a real value for every key, so we
    // first reveal anything we don't already have a pending edit for.
    const next: Record<string, string> = {};
    for (const r of rows) {
      if (r.removed) continue;
      if (r.pending !== undefined) {
        next[r.key] = r.pending;
        continue;
      }
      if (r.revealed !== undefined) {
        next[r.key] = r.revealed;
        continue;
      }
      // Need to fetch the existing value so we don't lose it on PATCH.
      const v = await onReveal(hostKey, r.key);
      next[r.key] = v ?? '';
    }
    await onSave({ secrets: next });
  }, [rows, onSave, onReveal, hostKey]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className="config-secrets">
        <div className="config-secrets__add">
          <input
            type="text"
            className="config-secrets__add-key"
            placeholder="NEW_SECRET_KEY"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
          />
          <input
            type="password"
            className="config-secrets__add-value"
            placeholder="value"
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
          />
          <UiButton disabled={!newKey.trim()} onClick={handleAdd}>Add</UiButton>
        </div>

        <div className="config-secrets__table">
          {rows.length === 0 && (
            <div className="config-secrets__empty">No secrets stored.</div>
          )}
          {rows.map((r, idx) => {
            const showVal = r.pending !== undefined ? r.pending
              : r.revealed !== undefined ? r.revealed
                : (r.meta?.hint || '—');
            const isRevealed = r.pending !== undefined || r.revealed !== undefined;
            return (
              <div
                key={r.key}
                className={`config-secrets__row${r.removed ? ' config-secrets__row--removed' : ''}`}
              >
                <span className="config-secrets__key">{r.key}</span>
                {isRevealed ? (
                  <input
                    type="text"
                    className="config-secrets__value"
                    value={showVal}
                    onChange={(e) => handleEdit(idx, e.target.value)}
                  />
                ) : (
                  <code className="config-secrets__masked">
                    {r.meta?.hint || '***'} · len={r.meta?.length ?? 0}
                  </code>
                )}
                {!isRevealed ? (
                  <button
                    type="button"
                    className="config-secrets__btn"
                    title="Reveal"
                    disabled={r.revealing}
                    onClick={() => handleReveal(idx)}
                  >
                    <UiIcon icon={r.revealing ? 'fa-spinner' : 'fa-eye'} spin={r.revealing} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="config-secrets__btn"
                    title="Hide"
                    onClick={() => handleHide(idx)}
                  >
                    <UiIcon icon="fa-eye-slash" />
                  </button>
                )}
                <button
                  type="button"
                  className={`config-secrets__btn config-secrets__btn--danger${r.removed ? ' is-active' : ''}`}
                  title={r.removed ? 'Undo remove' : 'Remove'}
                  onClick={() => handleRemove(idx)}
                >
                  <UiIcon icon={r.removed ? 'fa-rotate-left' : 'fa-trash-can'} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="config-secrets__actions">
          <UiButton busy={saving} disabled={!dirty} onClick={handleSave}>
            {dirty ? 'Save secrets' : 'Saved'}
          </UiButton>
        </div>
        <p className="config-secrets__note">
          Saving rewrites the entire <code>secrets</code> JSONB. Hidden values
          are re-fetched from the server before saving so they aren't lost.
        </p>
      </div>
    </>
  );
};

export default ConfigSecrets;
