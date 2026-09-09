// Editable host fields. Text fields share one UiForm + save. Each JSON field
// expands its keys into typed inputs (bool→checkbox, num→pill, str→text,
// object→textarea, object-array→one button per item) inside its own UiForm
// with its own save button. Object-array items carry an `enabled` flag that
// the toggle button flips; items are never removed, so save is non-destructive.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './ConfigEditableHost.scss';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import { getService } from '@webstack/common';
import IAdminService from '~/src/core/services/AdminService/IAdminService';
import { TEXT_FIELDS, JSON_FIELDS } from './fields';
import { isObjectArray, pickIdKey, objToFields, coerce, buildObjArrayButtonFields, type ObjArrayState } from './hostFieldUtils';

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  hostKey?: string;
  config: any | null;
  loading: boolean;
  saving: boolean;
  onSave: (patch: Record<string, any>) => Promise<void>;
}

const ConfigEditableHost: React.FC<Props> = ({ hostKey, config, loading, saving, onSave }) => {
  const adminService = useMemo(() => getService<IAdminService>('IAdminService'), []);
  // Live relay state from /gpio/status. Keyed by relay id.
  const [relayOn, setRelayOn] = useState<Record<string, boolean>>({});
  const [textDraft,  setTextDraft]  = useState<Record<string, string>>({});
  // jsonDrafts[fieldName][key] = draft value (typed)
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, Record<string, any>>>({});
  // objArrays[fieldName][key] holds the original items list + per-id enabled
  // map. Toggling never removes items — it only flips `enabled` so save is
  // non-destructive. (ObjArrayState + the button-field builder live in hostFieldUtils.)
  const [objArrays, setObjArrays] = useState<Record<string, Record<string, ObjArrayState>>>({});
  const [kioskDraft, setKioskDraft] = useState<string>('');
  const [kioskEnabledDraft, setKioskEnabledDraft] = useState<boolean>(false);

  useEffect(() => {
    if (!config) {
      setTextDraft({}); setJsonDrafts({}); setObjArrays({});
      setKioskDraft(''); setKioskEnabledDraft(false); return;
    }

    const td: Record<string, string> = {};
    TEXT_FIELDS.forEach(f => { td[f.name as string] = config[f.name as string] ?? ''; });
    setTextDraft(td);

    const jd: Record<string, Record<string, any>> = {};
    const oa: Record<string, Record<string, ObjArrayState>> = {};
    JSON_FIELDS.forEach(f => {
      const v = config[f.name];
      if (Array.isArray(v)) {
        jd[f.name] = { [f.name]: v };          // wrap array under its own key
      } else if (v && typeof v === 'object') {
        jd[f.name] = { ...v };
        // Collect object-array sub-fields into separate state
        Object.entries(v).forEach(([k, val]) => {
          if (!isObjectArray(val)) return;
          const idKey = pickIdKey(val[0]);
          const items: Array<Record<string, any>> = [];
          const enabledMap: Record<string, boolean> = {};
          (val as Record<string, any>[]).forEach((item, i) => {
            const id = item[idKey] ?? i;
            items.push(item);
            // `enabled` defaults to true when absent (back-compat with
            // existing relay configs that have no `enabled` field).
            enabledMap[String(id)] = item.enabled !== false;
          });
          if (!oa[f.name]) oa[f.name] = {};
          oa[f.name][k] = { items, enabledMap, idKey };
        });
      } else {
        jd[f.name] = {};
      }
    });
    setJsonDrafts(jd);
    setObjArrays(oa);

    setKioskDraft(config?.services?.kiosk_url ?? '');
    setKioskEnabledDraft(Boolean(config?.services?.kiosk));
  }, [config]);

  // Pull live relay state from the device so the buttons reflect the
  // physical pin, not the config-level `enabled` flag.
  useEffect(() => {
    if (!hostKey || !config?.gpio?.relays?.length) { setRelayOn({}); return; }
    let cancelled = false;
    adminService.getGpioStatus(hostKey).then((res: any) => {
      if (cancelled || !res?.relays) return;
      const m: Record<string, boolean> = {};
      for (const r of res.relays) m[String(r.id)] = !!r.on;
      setRelayOn(m);
    });
    return () => { cancelled = true; };
  }, [adminService, hostKey, config?.gpio]);

  const toggleRelayPhysical = useCallback(async (relayId: number) => {
    if (!hostKey) return;
    const cur = !!relayOn[String(relayId)];
    const next = !cur;
    setRelayOn(prev => ({ ...prev, [String(relayId)]: next })); // optimistic
    const res: any = await adminService.setGpioRelay(hostKey, relayId, next);
    if (res?.isAxiosError) {
      setRelayOn(prev => ({ ...prev, [String(relayId)]: cur }));
      const detail = res?.response?.data?.detail || res?.message || 'set failed';
      if (typeof window !== 'undefined') window.alert(`Relay ${relayId}: ${detail}`);
    }
  }, [adminService, hostKey, relayOn]);

  const toggleObjArrayItem = useCallback((fieldName: string, key: string, id: string | number) => {
    setObjArrays(prev => {
      const fld = prev[fieldName]?.[key];
      if (!fld) return prev;
      const idStr = String(id);
      const nextEnabled = { ...fld.enabledMap, [idStr]: !fld.enabledMap[idStr] };
      return {
        ...prev,
        [fieldName]: { ...prev[fieldName], [key]: { ...fld, enabledMap: nextEnabled } },
      };
    });
  }, []);

  // ── text fields ───────────────────────────────────────────────────────────

  const textFields = useMemo(() =>
    TEXT_FIELDS.map(f => ({ ...(f as object), type: 'text', value: textDraft[f.name as string] ?? '' })),
  [textDraft]);

  const handleTextChange = useCallback((e: any) => {
    const { name, value } = e?.target ?? {};
    if (name) setTextDraft(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleTextSave = useCallback(async () => {
    const patch: Record<string, any> = {};
    TEXT_FIELDS.forEach(f => {
      const name = f.name as string;
      const next = (textDraft[name] ?? '').trim();
      if (String(config?.[name] ?? '') !== next) patch[name] = next || null;
    });
    if (Object.keys(patch).length) await onSave(patch);
  }, [config, textDraft, onSave]);

  // ── kiosk URL ─────────────────────────────────────────────────────────────

  const handleKioskSave = useCallback(async (sf?: any[]) => {
    const urlField = sf?.find((x: any) => x.name === '_kiosk_url');
    const enabledField = sf?.find((x: any) => x.name === '_kiosk_enabled');
    const url = String(urlField?.value ?? kioskDraft).trim();
    const enabled = enabledField ? Boolean(enabledField.value) : kioskEnabledDraft;
    await onSave({ services: { ...(config?.services ?? {}), kiosk: enabled, kiosk_url: url } });
  }, [config, kioskDraft, kioskEnabledDraft, onSave]);

  // ── JSON fields ───────────────────────────────────────────────────────────

  const handleJsonKeyChange = useCallback((fieldName: string, e: any) => {
    const { name, value } = e?.target ?? {};
    if (!name) return;
    setJsonDrafts(prev => ({
      ...prev,
      [fieldName]: { ...(prev[fieldName] ?? {}), [name]: value },
    }));
  }, []);

  const handleJsonSave = useCallback(async (fieldName: string, sf?: any[]) => {
    const originalVal = config?.[fieldName];

    // Top-level array (e.g. hostnames): wrapped under its own key — unwrap on save
    if (Array.isArray(originalVal)) {
      const found = sf?.find((x: any) => x.name === fieldName);
      const next = found ? found.value : (jsonDrafts[fieldName]?.[fieldName] ?? originalVal);
      await onSave({ [fieldName]: Array.isArray(next) ? next : originalVal });
      return;
    }

    const original: Record<string, any> = originalVal ?? {};
    const source: Record<string, any> = {};
    if (sf?.length) {
      // Skip our injected object-array toggle buttons — their names are
      // synthetic (`__oa__<key>__<id>`) and they don't represent scalar values.
      sf.forEach((x: any) => {
        if (typeof x?.name === 'string' && x.name.startsWith('__oa__')) return;
        source[x.name] = x.value;
      });
    } else {
      Object.assign(source, jsonDrafts[fieldName] ?? {});
    }
    const reconstructed: Record<string, any> = {};
    for (const [k, v] of Object.entries(source)) {
      reconstructed[k] = coerce(v, original[k]);
    }
    // Merge in object-array sub-fields (e.g. gpio.relays). Non-destructive:
    // every item is written back; only the `enabled` flag changes per toggle.
    const oa = objArrays[fieldName] ?? {};
    for (const [k, { items, enabledMap, idKey }] of Object.entries(oa)) {
      reconstructed[k] = items.map(item => ({
        ...item,
        enabled: enabledMap[String(item[idKey])] !== false,
      }));
    }
    await onSave({ [fieldName]: reconstructed });
  }, [config, jsonDrafts, objArrays, onSave]);

  if (loading && !config) return <div className="config-editable-host__empty">Loading…</div>;

  return (
    <>
      <style jsx>{styles}</style>
      <div className="config-editable-host">

        {/* Kiosk URL */}
        {config && (
          <div className="config-editable-host__kiosk">
            <UiForm
              fields={[
                {
                  name: '_kiosk_enabled',
                  label: 'Kiosk Enabled',
                  type: 'checkbox',
                  value: kioskEnabledDraft,
                },
                {
                  name: '_kiosk_url',
                  label: 'Kiosk URL',
                  type: 'text',
                  placeholder: 'https://vdo.ninja/...',
                  value: kioskDraft,
                },
              ] as any}
              onChange={(e: any) => {
                const { name, value, checked } = e?.target ?? {};
                if (name === '_kiosk_enabled') setKioskEnabledDraft(Boolean(checked ?? value));
                else if (name === '_kiosk_url') setKioskDraft(String(value ?? ''));
              }}
              onSubmit={handleKioskSave}
              submitText="Update Kiosk"
              loading={saving}
            />
          </div>
        )}

        {/* Text fields */}
        <UiForm
          fields={textFields as any}
          onChange={handleTextChange}
          onSubmit={handleTextSave}
          submitText="Save Changes"
          loading={saving}
        />

        {/* JSON fields: each key → its own typed input */}
        {JSON_FIELDS.map(f => {
          const scalarFields = objToFields(jsonDrafts[f.name] ?? {});
          const sectionObjArrays = objArrays[f.name] ?? {};
          const objArrayEntries = Object.entries(sectionObjArrays);

          // For each object-array sub-field (e.g. gpio.relays), emit one
          // UiForm `'button'` field per item (see buildObjArrayButtonFields).
          const buttonFields = buildObjArrayButtonFields(
            f.name, objArrayEntries, relayOn, toggleRelayPhysical, toggleObjArrayItem,
          );

          const allFields = [...scalarFields, ...buttonFields];
          const isEmpty = allFields.length === 0;

          return (
            <div key={f.name} className="config-editable-host__json-section">
              {!isEmpty ? (
                <UiForm
                  fields={allFields}
                  onChange={(e: any) => handleJsonKeyChange(f.name, e)}
                  onSubmit={(sf) => handleJsonSave(f.name, sf as any[])}
                  submitText={`Save ${f.label}`}
                  loading={saving}
                />
              ) : (
                <div className="config-editable-host__json-empty">
                  <span className="config-editable-host__json-label">{f.label}</span>
                  <em>empty</em>
                </div>
              )}
            </div>
          );
        })}

      </div>
    </>
  );
};

export default ConfigEditableHost;
