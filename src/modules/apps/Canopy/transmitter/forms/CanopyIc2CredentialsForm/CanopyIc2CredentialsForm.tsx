import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getService } from '@webstack/common';
import IHomeService, { IIc2Credential } from '~/src/core/services/HomeService/IHomeService';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { useNotification } from '@webstack/components/Notification/Notification';

type Props = {
  /** Hide the "Add credential" form once a credential is selected; consumers can re-toggle. */
  initialMode?: 'list' | 'add';
  /** Called whenever the credential list changes (after add/delete). */
  onChanged?: (creds: IIc2Credential[]) => void;
};

// Read onChanged through a ref so refresh's useCallback identity doesn't churn
// when the parent passes a new inline arrow each render.

const empty = {
  name: '',
  org_id: '',
  group_id: '',
  client_id: '',
  client_secret: '',
};

const CanopyIc2CredentialsForm: React.FC<Props> = ({ initialMode = 'list', onChanged }) => {
  const home = useMemo(() => getService<IHomeService>('IHomeService'), []);
  const [, setNotification] = useNotification();
  const [creds, setCreds] = useState<IIc2Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'list' | 'add'>(initialMode);
  const [draft, setDraft] = useState({ ...empty });

  const onChangedRef = useRef(onChanged);
  useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await home.ic2ListCredentials();
      setCreds(list);
      onChangedRef.current?.(list);
    } catch (e) {
      console.error('[ic2-creds] list failed', e);
    } finally {
      setLoading(false);
    }
  }, [home]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleSave = useCallback(async () => {
    const body = {
      name: draft.name.trim() || undefined,
      org_id: draft.org_id.trim(),
      group_id: draft.group_id.trim(),
      client_id: draft.client_id.trim(),
      client_secret: draft.client_secret.trim(),
    };
    if (!body.org_id || !body.group_id || !body.client_id || !body.client_secret) {
      setNotification?.({
        active: true, persistence: 3500, dismissable: true,
        list: [{ label: 'Missing fields', message: 'Org, Group, Client ID, and Client Secret are required.' }],
      });
      return;
    }
    setSaving(true);
    try {
      await home.ic2CreateCredential(body);
      setDraft({ ...empty });
      setMode('list');
      await refresh();
      setNotification?.({
        active: true, persistence: 2500, dismissable: true,
        list: [{ label: 'Saved', message: 'IC2 credential verified and stored.' }],
      });
    } catch (e: any) {
      const detail = typeof e?.detail?.detail === 'string'
        ? e.detail.detail
        : (e?.message || 'Could not save credential.');
      setNotification?.({
        active: true, persistence: 4500, dismissable: true,
        list: [{ label: 'Save failed', message: detail }],
      });
    } finally {
      setSaving(false);
    }
  }, [draft, home, refresh, setNotification]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Delete this IC2 credential? Any teams using it will stop receiving GPS until reassigned.')) return;
    try {
      await home.ic2DeleteCredential(id);
      await refresh();
    } catch (e) {
      console.error('[ic2-creds] delete failed', e);
    }
  }, [home, refresh]);

  return (
    <div className="ic2-creds">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>IC2 Credentials</div>
        <UiButton size="xs" variant="flat" onClick={() => setMode(mode === 'add' ? 'list' : 'add')}>
          {mode === 'add' ? 'Cancel' : '+ Add'}
        </UiButton>
      </div>

      {loading ? (
        <div style={{ opacity: 0.7, padding: 8 }}>Loading…</div>
      ) : creds.length === 0 ? (
        <div style={{ opacity: 0.6, padding: 8 }}>No IC2 credentials yet. Add one to bind teams to Peplink GPS.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {creds.map((c) => (
            <li key={c.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, marginBottom: 6,
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.name || `${c.org_id} / ${c.group_id}`}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>org {c.org_id} · group {c.group_id} · client {c.client_id.slice(0, 8)}…</div>
              </div>
              <UiButton size="xs" variant="danger" onClick={() => handleDelete(c.id)}>Delete</UiButton>
            </li>
          ))}
        </ul>
      )}

      {mode === 'add' && (
        <div style={{ marginTop: 12, padding: 10, border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <UiInput label="Name (optional)" placeholder="e.g. XINSURANCE" value={draft.name}
              onChange={(e: any) => setDraft(d => ({ ...d, name: String(e?.target?.value ?? '') }))} />
            <UiInput label="Org ID" placeholder="e.g. fxu3ea" value={draft.org_id}
              onChange={(e: any) => setDraft(d => ({ ...d, org_id: String(e?.target?.value ?? '') }))} />
            <UiInput label="Group ID" placeholder="e.g. 3" value={draft.group_id}
              onChange={(e: any) => setDraft(d => ({ ...d, group_id: String(e?.target?.value ?? '') }))} />
            <UiInput label="Client ID" placeholder="OAuth client id" value={draft.client_id}
              onChange={(e: any) => setDraft(d => ({ ...d, client_id: String(e?.target?.value ?? '') }))} />
            <UiInput label="Client Secret" placeholder="OAuth client secret" value={draft.client_secret}
              onChange={(e: any) => setDraft(d => ({ ...d, client_secret: String(e?.target?.value ?? '') }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <UiButton variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Verifying…' : 'Save & Verify'}
            </UiButton>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
            Save calls Peplink IC2 to confirm credentials before storing. The Org / Group / Client ID and Secret are reusable across every team and event you run.
          </div>
        </div>
      )}
    </div>
  );
};

export default CanopyIc2CredentialsForm;
