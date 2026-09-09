// Fleet-wide system_config editor. Lists every row, masks secrets.* with
// reveal/edit, allows adding/deleting rows. Each save / delete is a
// separate API call (one row at a time).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './ConfigFleet.scss';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';

type FleetRow = {
  key: string;
  value: any;
  masked: boolean;
  updated_at?: string;
};

interface Props {
  rows: FleetRow[];
  loading: boolean;
  saving: boolean;
  onLoad: () => Promise<void>;
  onSave: (key: string, value: any) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  onRevealSecret: (name: string) => Promise<string | null>;
}

const KIOSK_KEYS = ['kiosk.target_url', 'kiosk.zoom', 'kiosk.width', 'kiosk.height', 'kiosk.rotation'];

const ConfigFleet: React.FC<Props> = ({ rows, loading, saving, onLoad, onSave, onDelete, onRevealSecret }) => {
  const [filter, setFilter] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});
  const [addFields, setAddFields] = useState<{ key: string; value: string }>({ key: '', value: '' });

  useEffect(() => { setDrafts({}); setRevealed({}); }, [rows]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.key.toLowerCase().includes(q));
  }, [rows, filter]);

  const valueAsString = (v: any): string => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && 'value' in v && Object.keys(v).length === 1) {
      return v.value == null ? '' : (typeof v.value === 'string' ? v.value : JSON.stringify(v.value, null, 2));
    }
    try { return JSON.stringify(v, null, 2); } catch { return ''; }
  };

  const parseDraft = (raw: string): any => {
    const t = raw.trim();
    if (t === '') return '';
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return JSON.parse(t); } catch { /* fall through */ }
    }
    return t;
  };

  const handleReveal = useCallback(async (key: string) => {
    if (!key.startsWith('secrets.')) return;
    const name = key.substring('secrets.'.length);
    setRevealing(prev => ({ ...prev, [key]: true }));
    const v = await onRevealSecret(name);
    setRevealing(prev => ({ ...prev, [key]: false }));
    if (v !== null) {
      setRevealed(prev => ({ ...prev, [key]: v }));
      setDrafts(prev => ({ ...prev, [key]: v }));
    }
  }, [onRevealSecret]);

  const handleSaveRow = useCallback(async (key: string) => {
    const draft = drafts[key];
    if (draft === undefined) return;
    await onSave(key, parseDraft(draft));
  }, [drafts, onSave]);

  const handleAdd = useCallback(async (submittedFields?: any[]) => {
    // Read from submitted fields (passed by UiForm) or fall back to state
    const find = (name: string) =>
      submittedFields?.find((f: any) => f.name === name)?.value ?? addFields[name as keyof typeof addFields];
    const k = String(find('key') ?? '').trim();
    const v = String(find('value') ?? '');
    if (!k) return;
    await onSave(k, parseDraft(v));
    setAddFields({ key: '', value: '' });
  }, [addFields, onSave]);

  const handleAddChange = (e: any) => {
    const { name, value } = e.target;
    setAddFields(prev => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="config-fleet">

        <div className="config-fleet__toolbar">
          <UiInput
            name="filter"
            placeholder={`filter ${rows.length} rows…`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <UiButton onClick={onLoad} busy={loading}>Reload</UiButton>
        </div>

        <div className="config-fleet__add">
          <UiForm
            fields={[
              {
                name: 'key',
                label: 'Key',
                type: 'text',
                required: true,
                placeholder: 'fleet.section.NAME or secrets.NAME',
                value: addFields.key,
              },
              {
                name: 'value',
                label: 'Value',
                type: 'text',
                placeholder: 'value (string or JSON)',
                value: addFields.value,
              },
            ]}
            onChange={handleAddChange}
            onSubmit={handleAdd}
            submitText="Add Row"
            loading={saving}
          />
        </div>

        <div className="config-fleet__table">
          {visible.length === 0 && (
            <div className="config-fleet__empty">
              {loading ? 'Loading…' : 'No rows.'}
            </div>
          )}
          {visible.map((r) => {
            const isSecret = r.masked;
            const isKiosk = KIOSK_KEYS.includes(r.key);
            const draft = drafts[r.key];
            const display = draft !== undefined ? draft : valueAsString(r.value);
            const dirty = draft !== undefined && draft !== valueAsString(r.value);
            const isRevealed = isSecret && revealed[r.key] !== undefined;
            return (
              <div key={r.key} className={`config-fleet__row${isKiosk ? ' config-fleet__row--kiosk' : ''}`}>
                <code className="config-fleet__key">{r.key}</code>
                {isSecret && !isRevealed ? (
                  <code className="config-fleet__masked">
                    {(r.value as any)?.hint || '***'} · len={(r.value as any)?.length ?? 0}
                  </code>
                ) : (
                  <textarea
                    className="config-fleet__value"
                    rows={display.includes('\n') ? Math.min(8, display.split('\n').length) : 1}
                    value={display}
                    onChange={(e) => setDrafts(prev => ({ ...prev, [r.key]: e.target.value }))}
                  />
                )}
                <div className="config-fleet__row-actions">
                  {isSecret && !isRevealed && (
                    <button
                      type="button"
                      className="config-fleet__btn"
                      title="Reveal"
                      disabled={revealing[r.key]}
                      onClick={() => handleReveal(r.key)}
                    >
                      <UiIcon icon={revealing[r.key] ? 'fa-spinner' : 'fa-eye'} spin={revealing[r.key]} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="config-fleet__btn"
                    title="Save"
                    disabled={!dirty || saving}
                    onClick={() => handleSaveRow(r.key)}
                  >
                    <UiIcon icon="fa-floppy-disks" />
                  </button>
                  <button
                    type="button"
                    className="config-fleet__btn config-fleet__btn--danger"
                    title="Delete row"
                    disabled={saving}
                    onClick={() => onDelete(r.key)}
                  >
                    <UiIcon icon="fa-trash-can" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default ConfigFleet;
