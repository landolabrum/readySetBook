import React, { useEffect, useMemo, useState, useCallback } from 'react';
import styles from './CanopyTeamForm.scss';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import { getService } from '@webstack/common';
import IDataBaseService from '~/src/core/services/DataBaseService/IDataBaseService';
import IHomeService, { IIc2Credential, IIc2Device } from '~/src/core/services/HomeService/IHomeService';
import { useNotification } from '@webstack/components/Notification/Notification';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiCollapse from '@webstack/components/UiCollapse/UiCollapse';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import CanopyIc2CredentialsForm from '../CanopyIc2CredentialsForm/CanopyIc2CredentialsForm';

export type RosterRow = {
  id?: string | number;
  event_id?: string | number;
  team_id?: string | number | null;
  team_name?: string;
  vehicle_number?: string | number | null;
  competitors?: Array<{ id?: string; name?: string | null; position?: number | null }>;
  primary_vehicle?: string | null;
};

type AdminLiveStreamEditTeamProps = {
  team?: Partial<RosterRow> | null;
  eventId?: string;
  onUpdated?: (saved?: RosterRow) => void;
};

type GpsSource = 'ic2' | 'udp' | 'tcp';

const TEAM_FIELDS: Array<{ name: keyof RosterRow; label: string; required?: boolean }> = [
  { name: 'team_name', label: 'Team Name', required: true },
  { name: 'vehicle_number', label: 'Vehicle Number' },
  { name: 'primary_vehicle', label: 'Primary Vehicle' },
];


const compact = (obj: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')) out[k] = v;
  }
  return out;
};

const keyForTeam = (r: RosterRow) =>
  `${(r.team_name || '').toString().trim().toLowerCase()}|${(r.vehicle_number ?? '')}`
    .toString()
    .trim()
    .toLowerCase();

/** Coerce UiSelect/mixed values to primitives for storage/rendering */
const coerceSelectVal = (v: any) => (v && typeof v === 'object' ? (v.value ?? v.label ?? '') : v);

/** API base for overlay ping */
function getApiBaseFromDb() {
  const db: any = getService<IDataBaseService>('IDataBaseService');
  return String(db?.baseUrl || db?.getBaseUrl?.() || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
}

async function overlayPing(eventId?: string | number) {
  if (!eventId) return;
  const api = getApiBaseFromDb();
  if (!api) return;
  try {
    await fetch(`${api}/db/overlay_ping?event_id=${encodeURIComponent(String(eventId))}`, {
      method: 'POST',
      keepalive: true,
    });
  } catch {
    /* best effort */
  }
}

// Ensure a competitor exists for a given name and return its cmp_* id
async function ensureCompetitorIdByName(name?: string | null): Promise<string | null> {
  const db: any = getService<IDataBaseService>('IDataBaseService');
  const n = String(name || '').trim();
  if (!n) return null;
  try {
    const res = await db.selectData({ tableName: 'event_competitors', where: { exact: { name: n } } });
    const row = Array.isArray(res?.data) ? res.data[0] : undefined;
    if (row?.id) return String(row.id);
  } catch { }
  const id = `cmp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`;
  try {
    await db.insertData({ tableName: 'event_competitors', data: { id, name: n, address: {}, metadata: {} } });
    return id;
  } catch {
    try {
      const retry = await db.selectData({ tableName: 'event_competitors', where: { exact: { name: n } } });
      const row = Array.isArray(retry?.data) ? retry.data[0] : undefined;
      if (row?.id) return String(row.id);
    } catch { }
  }
  return null;
}

type CompetitorDraft = {
  name: string;
  email?: string;
  phone?: string;
  role?: string | null;
  img_url?: string;
  description?: string;
  preferred_locales?: string;     // CSV in UI, split on save
  wins?: string;                  // CSV in UI
  attended?: string;              // CSV in UI
  addressText?: string;           // JSON text in UI
  metadataText?: string;          // JSON text in UI
};

type GpsBindingRow = {
  id?: number;
  source?: string | null;
  device_id?: number | null;
  ic2_credential_id?: number | null;
  port?: number | null;
  label?: string | null;
  last_fix?: { lat?: number | string | null; lon?: number | string | null; timestamp?: string | number | null } | null;
};

async function upsertCompetitorsReturnIds(drafts: CompetitorDraft[]): Promise<string[]> {
  const db: any = getService<IDataBaseService>('IDataBaseService');
  const ids: string[] = [];
  for (const d of drafts) {
    const name = String(d?.name || '').trim();
    if (!name) continue;
    const id = await ensureCompetitorIdByName(name);
    if (!id) continue;

    // Prepare update set from draft fields
    const set: any = {};
    if (d.email) set.email = String(d.email);
    if (d.phone) set.phone = String(d.phone);
    if (d.role != null && String(d.role).trim() !== '') set.role = String(d.role);
    if (d.img_url) set.img_url = String(d.img_url);
    if (d.description) set.description = String(d.description);

    const parseCsv = (s?: string) =>
      String(s || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    const locales = parseCsv(d.preferred_locales);
    const wins = parseCsv(d.wins);
    const attended = parseCsv(d.attended);
    if (locales.length) set.preferred_locales = locales;
    if (wins.length) set.wins = wins;
    if (attended.length) set.attended = attended;

    const safeJson = (t?: string, fallback: any = undefined) => {
      const raw = String(t || '').trim();
      if (!raw) return fallback;
      try { return JSON.parse(raw); } catch { return fallback; }
    };
    const address = safeJson(d.addressText);
    const metadata = safeJson(d.metadataText);
    if (address && typeof address === 'object') set.address = address;
    if (metadata && typeof metadata === 'object') set.metadata = metadata;

    if (Object.keys(set).length > 0) {
      try {
        await db.updateData({ tableName: 'event_competitors', set, where: { id } });
      } catch (e) {
        console.warn('[competitor:update] ignored error', e);
      }
    }

    ids.push(id);
  }
  return ids;
}

/** Build GPS options from fields. IC2 source returns the stored credential
 *  id + device id; UDP/TCP returns the port. */
function normalizeGpsFromFields(fields: IFormField[]) {
  const rawSrc = fields.find(f => f.name === 'gps_source')?.value;
  const src = String(coerceSelectVal(rawSrc) ?? 'ic2') as GpsSource;
  const label = String(fields.find(f => f.name === 'gps_label')?.value ?? '').trim() || undefined;

  if (src === 'ic2') {
    const cred_raw = coerceSelectVal(fields.find(f => f.name === 'ic2_credential_id')?.value);
    const dev_raw = coerceSelectVal(fields.find(f => f.name === 'gps_device_id')?.value);
    const ic2_credential_id = Number(cred_raw);
    const device_id = Number(dev_raw);
    // Must be positive integers — Number('') = 0 which is finite but invalid
    if (!Number.isFinite(ic2_credential_id) || ic2_credential_id <= 0 || !Number.isFinite(device_id) || device_id <= 0) return null;
    return compact({ source: src, ic2_credential_id, device_id, label });
  } else {
    const port_raw = fields.find(f => f.name === 'gps_port')?.value;
    const port = Number(port_raw);
    if (!Number.isFinite(port) || port <= 0) return null;
    return compact({ source: src, port, label });
  }
}

const AdminLiveStreamEditTeam: React.FC<AdminLiveStreamEditTeamProps> = ({ team, eventId, onUpdated }) => {
  const db = useMemo(() => getService<IDataBaseService>('IDataBaseService'), []);
  const home = useMemo(() => getService<IHomeService>('IHomeService'), []);
  const isEdit = Boolean(team?.id);
  const effectiveEventId = String(team?.event_id ?? eventId ?? '');

  /* ========= Previous Teams ========= */

  const [prevTeams, setPrevTeams] = useState<RosterRow[] | null>(null);
  const [prevLoading, setPrevLoading] = useState<boolean>(false);
  const [, setNotification] = useNotification();
  const [search, setSearch] = useState<string>('');
  const [gpsBinding, setGpsBinding] = useState<GpsBindingRow | null>(null);

  const duplicateTeamByVehicle = useCallback(
    async (vehicleNumber?: string | number, excludeId?: string | number) => {
      const vehicle = String(vehicleNumber ?? '').trim();
      if (!vehicle || !effectiveEventId) return null;
      try {
        const res = await db.selectData({
          tableName: 'event_team',
          where: { exact: { event_id: effectiveEventId, vehicle_number: vehicle } },
        });
        const rows = Array.isArray(res?.data) ? res.data : [];
        return rows.find((row: any) => String(row?.id ?? row?.team_id ?? row?.event_team_id ?? '') !== String(excludeId ?? ''));
      } catch {
        return null;
      }
    },
    [db, effectiveEventId]
  );

  const notifyDuplicateVehicle = useCallback(
    (vehicle?: string) => {
      const vehicleLabel = vehicle ? `Vehicle #${vehicle}` : 'This vehicle number';
      setNotification?.({
        active: true,
        persistence: 4000,
        dismissable: true,
        list: [
          {
            label: 'Duplicate vehicle number',
            message: `${vehicleLabel} is already registered for this event.`,
          },
        ],
      });
    },
    [setNotification]
  );

  const notifyGpsBindError = useCallback(
    (error: unknown) => {
      const detail =
        typeof error === 'string'
          ? error
          : typeof (error as any)?.detail?.detail === 'string'
            ? (error as any)?.detail?.detail
            : typeof (error as any)?.message === 'string'
              ? (error as any)?.message
              : 'Could not bind GPS feed (check credentials).';
      setNotification?.({
        active: true,
        persistence: 4000,
        dismissable: true,
        list: [{ label: 'GPS binding failed', message: detail }],
      });
    },
    [setNotification]
  );

  const loadPreviousTeams = useCallback(async () => {
    setPrevLoading(true);
    try {
      const res = await db.selectData({ tableName: 'event_team' });
      const list: RosterRow[] = Array.isArray(res?.data) ? res.data : [];
      const filtered = effectiveEventId ? list.filter(r => String(r.event_id ?? '') !== String(effectiveEventId)) : list;
      const map = new Map<string, RosterRow>();
      filtered.forEach((r: RosterRow) => {
        const k = keyForTeam(r);
        if (!map.has(k)) map.set(k, r);
      });
      setPrevTeams(Array.from(map.values()));
    } catch (e) {
      setPrevTeams([]);
      console.error('[EditTeam] loadPreviousTeams failed', e);
    } finally {
      setPrevLoading(false);
    }
  }, [db, effectiveEventId]);

  useEffect(() => {
    if (!effectiveEventId || !team?.id) {
      setGpsBinding(null);
      return;
    }

    let canceled = false;
    (async () => {
      try {
        const res = await db.selectData({
          tableName: 'gps_binding',
          where: { exact: { event_id: effectiveEventId, team_id: team.id } },
        });
        if (canceled) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        setGpsBinding(rows[0] ?? null);
      } catch (err) {
        console.error('[EditTeam] load GPS binding failed', err);
        if (!canceled) setGpsBinding(null);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [db, effectiveEventId, team?.id]);

  useEffect(() => {
    void loadPreviousTeams();
  }, [loadPreviousTeams]);

  const filteredPrevTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prevTeams ?? [];
    return (prevTeams ?? []).filter((r: RosterRow) => {
      const firstComp = Array.isArray(r?.competitors) ? (r.competitors[0]?.name ?? '') : (r as any).competitor_name ?? '';
      const hay = `${r.team_name ?? ''} ${r.vehicle_number ?? ''} ${firstComp} ${r.primary_vehicle ?? ''}`
        .toLowerCase()
        .trim();
      return hay.includes(q);
    });
  }, [prevTeams, search]);

  /* ========= UiForm Fields (Team + GPS) ========= */

  // Initialize team fields
  const initialTeamFields: IFormField[] = TEAM_FIELDS.map(({ name, label, required }) => ({
    type: 'text',
    name,
    label,
    required: Boolean(required),
    value: (team as any)?.[name] ?? '',
  }));

  // Initialize GPS fields. IC2 details come from stored credentials + a live
  // device list, so this form does not collect raw OAuth secrets anymore.
  const initialGpsFields: IFormField[] = [
    {
      type: 'select',
      name: 'gps_source',
      label: 'GPS Source',
      value: 'ic2',
      options: [
        { label: 'IC2 (Peplink)', value: 'ic2' },
        { label: 'UDP', value: 'udp' },
        { label: 'TCP', value: 'tcp' },
      ],
    },
    { type: 'select', name: 'ic2_credential_id', label: 'IC2 Credential', value: '', options: [], disabled: false, clearable: true },
    { type: 'select', name: 'gps_device_id', label: 'IC2 Device', value: '', options: [], disabled: true },
    { type: 'text', name: 'gps_port', label: 'Port', placeholder: 'e.g. 60660 or 60661', value: '', disabled: true },
    { type: 'text', name: 'gps_label', label: 'Label (optional)', placeholder: 'friendly label shown in gps_binding', value: '', disabled: false },
  ];

  const [formFields, setFormFields] = useState<IFormField[]>([...initialTeamFields, ...initialGpsFields]);
  const [credentials, setCredentials] = useState<IIc2Credential[]>([]);
  const [devicesByCred, setDevicesByCred] = useState<Record<number, IIc2Device[]>>({});
  const [credAuthErrors, setCredAuthErrors] = useState<Record<number, string>>({});
  const [showCredsManager, setShowCredsManager] = useState(false);

  const refreshCredentials = useCallback(async () => {
    try {
      const list = await home.ic2ListCredentials();
      setCredentials(list);
      return list;
    } catch (err) {
      console.warn('[EditTeam] ic2 list creds failed', err);
      return [];
    }
  }, [home]);

  useEffect(() => { void refreshCredentials(); }, [refreshCredentials]);

  const handleCredsChanged = useCallback((list: IIc2Credential[]) => setCredentials(list), []);

  // Sync credential dropdown options whenever the list changes.
  useEffect(() => {
    setFormFields(prev => prev.map(f => {
      if (f.name !== 'ic2_credential_id') return f;
      const opts = credentials.map(c => ({
        label: c.name ? `${c.name} (${c.org_id}/${c.group_id})` : `${c.org_id} / ${c.group_id}`,
        value: String(c.id),
      }));
      return { ...f, options: opts };
    }));
  }, [credentials]);

  const loadDevicesFor = useCallback(async (credId: number) => {
    if (!Number.isFinite(credId) || credId <= 0) return [];
    // Only use cache when it has actual results — don't cache failures
    if (devicesByCred[credId]?.length) return devicesByCred[credId];
    try {
      const list = await home.ic2ListDevices(credId);
      setDevicesByCred(prev => ({ ...prev, [credId]: list }));
      setCredAuthErrors(prev => { const next = { ...prev }; delete next[credId]; return next; });
      return list;
    } catch (err: any) {
      console.warn('[EditTeam] ic2 list devices failed', err);
      const msg = err?.message ?? 'Invalid credential — check client ID / secret';
      setCredAuthErrors(prev => ({ ...prev, [credId]: msg }));
      return [];
    }
  }, [home, devicesByCred]);

  // Competitors draft (multi)
  const [competitorsDraft, setCompetitorsDraft] = useState<CompetitorDraft[]>(() => {
    const list = Array.isArray((team as any)?.competitors)
      ? ((team as any).competitors as any[]).map((c) => ({ name: String(c?.name ?? '').trim() })).filter((c) => c.name)
      : ((team as any)?.competitor_name ? [{ name: String((team as any).competitor_name) }] : []);
    return list;
  });

  // keep team fields in sync when editing or switching team prop
  useEffect(() => {
    setFormFields(prev => {
      const copy = [...prev];
      for (const def of TEAM_FIELDS) {
        const idx = copy.findIndex(f => f.name === def.name);
        if (idx >= 0) {
          copy[idx] = { ...copy[idx], value: (team as any)?.[def.name] ?? '' };
        } else {
          copy.push({
            type: 'text',
            name: def.name as string,
            label: def.label,
            required: Boolean(def.required),
            value: (team as any)?.[def.name] ?? '',
          });
        }
      }

      if (gpsBinding) {
        copy.forEach((field, idx) => {
          if (field.name === 'gps_source' && gpsBinding.source) {
            copy[idx] = { ...field, value: gpsBinding.source };
          }
          if (field.name === 'ic2_credential_id' && gpsBinding.ic2_credential_id != null) {
            copy[idx] = { ...field, value: String(gpsBinding.ic2_credential_id) };
          }
          if (field.name === 'gps_device_id') {
            const value = gpsBinding.device_id != null ? String(gpsBinding.device_id) : '';
            if (value) copy[idx] = { ...field, value };
          }
          if (field.name === 'gps_port' && gpsBinding.port != null) {
            copy[idx] = { ...field, value: String(gpsBinding.port) };
          }
          if (field.name === 'gps_label' && gpsBinding.label) {
            copy[idx] = { ...field, value: gpsBinding.label };
          }
        });
      }

      return copy;
    });
  }, [team, gpsBinding]);

  // derived: current gps_source
  const gpsSource: GpsSource = useMemo(() => {
    const v = formFields.find(f => f.name === 'gps_source')?.value;
    const s = (typeof v === 'string' ? v : String(coerceSelectVal(v) || 'ic2')) as GpsSource;
    return (s || 'ic2') as GpsSource;
  }, [formFields]);

  // derived: currently-selected credential id
  const selectedCredId: number | undefined = useMemo(() => {
    const raw = coerceSelectVal(formFields.find(f => f.name === 'ic2_credential_id')?.value);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [formFields]);

  // When credential changes (or gps source flips to ic2), fetch its devices.
  useEffect(() => {
    if (gpsSource !== 'ic2' || !selectedCredId) return;
    void loadDevicesFor(selectedCredId);
  }, [gpsSource, selectedCredId, loadDevicesFor]);

  // Auto-open credential manager when the selected credential can't authenticate.
  useEffect(() => {
    if (selectedCredId && credAuthErrors[selectedCredId]) {
      setShowCredsManager(true);
    }
  }, [selectedCredId, credAuthErrors]);

  // Sync device dropdown options to the loaded device list for the selected cred.
  useEffect(() => {
    setFormFields(prev => prev.map(f => {
      if (f.name !== 'gps_device_id') return f;
      const list = selectedCredId ? (devicesByCred[selectedCredId] ?? []) : [];
      const opts = list.map(d => ({
        label: d.name ? `${d.name}${d.online === false ? ' (offline)' : ''}` : `Device #${d.id}`,
        value: String(d.id),
      }));
      return { ...f, options: opts };
    }));
  }, [devicesByCred, selectedCredId]);

  // Show only the fields relevant to the chosen GPS source.
  const visibleFormFields = useMemo(() => {
    const credError = selectedCredId ? credAuthErrors[selectedCredId] : undefined;
    return formFields.filter(f => {
      if (f.name === 'ic2_credential_id' || f.name === 'gps_device_id') return gpsSource === 'ic2';
      if (f.name === 'gps_port') return gpsSource === 'udp' || gpsSource === 'tcp';
      return true;
    }).map(f => {
      if (f.name === 'ic2_credential_id' && credError) {
        return { ...f, error: 'Auth failed — replace this credential' };
      }
      if (f.name === 'gps_device_id') {
        const disabled = !selectedCredId || Boolean(credError);
        const msg = credError ? 'Fix credential first' : undefined;
        return { ...f, disabled, placeholder: msg ?? f.placeholder };
      }
      return f;
    });
  }, [formFields, gpsSource, selectedCredId, credAuthErrors]);

  /* ========= Actions for “Previous teams” ========= */

  const prefillFrom = useCallback((row: RosterRow) => {
    setFormFields(prev =>
      prev.map(f => {
        if (f.name === 'team_name') return { ...f, value: row.team_name ?? '' };
        if (f.name === 'vehicle_number') return { ...f, value: row.vehicle_number ?? '' };
        if (f.name === 'primary_vehicle') return { ...f, value: row.primary_vehicle ?? '' };
        return f;
      })
    );
    const names = Array.isArray(row?.competitors)
      ? (row.competitors as any[]).map((c) => ({ name: String(c?.name ?? '').trim() })).filter((c) => c.name)
      : ((row as any)?.competitor_name ? [{ name: String((row as any).competitor_name) }] : []);
    setCompetitorsDraft(names);
  }, []);

  const quickAddToEvent = useCallback(
    async (row: RosterRow) => {
      if (!effectiveEventId) return;
      const normalizedVehicle = String(row.vehicle_number ?? '').trim();
      if (normalizedVehicle) {
        const conflict = await duplicateTeamByVehicle(normalizedVehicle);
        if (conflict) {
          notifyDuplicateVehicle(normalizedVehicle);
          return;
        }
      }
      try {
        const drafts = Array.isArray(row?.competitors)
          ? (row.competitors as any[]).map((c) => ({ name: String(c?.name ?? '').trim() })).filter((c) => c.name)
          : ((row as any)?.competitor_name ? [{ name: String((row as any).competitor_name) }] : []);
        const ids = await upsertCompetitorsReturnIds(drafts);
        const payload = compact({ event_id: effectiveEventId, team_name: row.team_name, vehicle_number: row.vehicle_number, primary_vehicle: row.primary_vehicle });
        const res = await db.insertData({ tableName: 'event_team', data: payload });
        const saved = (Array.isArray(res?.data) ? res.data?.[0] : res?.data) ?? payload;
        if (ids.length > 0 && saved?.id) {
          try { await db.deleteData({ tableName: 'event_team_competitors', where: { exact: { team_id: saved.id } } }); } catch { }
          let pos = 1;
          for (const cid of ids) {
            await db.insertData({ tableName: 'event_team_competitors', data: { team_id: saved.id, competitor_id: cid, role: null, position: pos++ } });
          }
        }

        await overlayPing(effectiveEventId);
        onUpdated?.(saved as RosterRow);
      } catch (e) {
        console.error('[EditTeam] quickAddToEvent failed', e);
      }
    },
    [db, effectiveEventId, onUpdated]
  );

  const prevTeamsRows = useMemo(
    () =>
      (filteredPrevTeams ?? []).map((r: RosterRow) => ({
        Team: r.team_name ?? '(unnamed)',
        Vehicle: r.vehicle_number ?? '',
        Competitor: Array.isArray(r?.competitors) ? (r.competitors[0]?.name ?? '') : (r as any).competitor_name ?? '',
        Primary: r.primary_vehicle ?? '',
        id: r.id ?? keyForTeam(r),
        Actions: (
          <div className="row-actions" onClick={e => e.stopPropagation()}>
            <UiButton size="xs" variant="flat" onClick={() => prefillFrom(r)}>
              Prefill
            </UiButton>
            <UiButton size="xs" variant="success" onClick={() => quickAddToEvent(r)}>
              Quick-Add
            </UiButton>
          </div>
        ),
      })),
    [filteredPrevTeams, prefillFrom, quickAddToEvent]
  );

  /* ========= UiForm submit / change ========= */

  const title = isEdit ? `Edit Team: ${team?.team_name ?? ''}` : 'Add Team';

  const handleFormChange = (e: any) => {
    const { name, value } = e?.target || {};
    if (!name) return;
    const next = coerceSelectVal(value);
    setFormFields(prev => prev.map(f => (f.name === name ? { ...f, value: next } : f)));
  };

  const handleSubmit = async (fieldsFromForm: IFormField[]) => {
    // Snapshot and coerce any select-ish objects to primitives
    const f = (fieldsFromForm?.length ? fieldsFromForm : formFields).map(ff => ({
      ...ff,
      value: coerceSelectVal(ff.value),
    })) as IFormField[];

    // Validate minimal team inputs
    const teamName = String(f.find(x => x.name === 'team_name')?.value ?? '').trim();
    if (!teamName || (!isEdit && !effectiveEventId)) {
      console.error('Missing required fields: team_name and event_id (for create).');
      return;
    }

    // Prepare team payload
    const teamPayload = {
      team_name: teamName,
      vehicle_number: String(f.find(x => x.name === 'vehicle_number')?.value ?? ''),
      primary_vehicle: String(f.find(x => x.name === 'primary_vehicle')?.value ?? ''),
    };

    const normalizedVehicle = String(teamPayload.vehicle_number ?? '').trim();
    if (normalizedVehicle) {
      const conflict = await duplicateTeamByVehicle(normalizedVehicle, isEdit ? team?.id : undefined);
      if (conflict) {
        notifyDuplicateVehicle(normalizedVehicle);
        return;
      }
    }

    // Normalize GPS (optional)
    const gpsCfg = normalizeGpsFromFields(f); // null if invalid/incomplete

    try {
      let saved: RosterRow;

      if (isEdit && team?.id) {
        // UPDATE team
        const set = compact({ team_name: teamPayload.team_name, vehicle_number: teamPayload.vehicle_number, primary_vehicle: teamPayload.primary_vehicle });
        const res = await db.updateData({ tableName: 'event_team', set, where: { id: team.id } });
        saved = { id: team.id, ...(Array.isArray(res?.data) ? res.data[0] : (res?.data ?? set)), event_id: team.event_id };
        // Upsert competitor list (replace entire set)
        try { await db.deleteData({ tableName: 'event_team_competitors', where: { exact: { team_id: team.id } } }); } catch { }
        const ids = await upsertCompetitorsReturnIds(competitorsDraft);
        let pos = 1;
        for (const cid of ids) {
          const draft = competitorsDraft[pos - 1];
          await db.insertData({ tableName: 'event_team_competitors', data: { team_id: team.id, competitor_id: cid, role: draft?.role ?? null, position: pos++ } });
        }

        // Bond on edit if GPS provided
        if (gpsCfg && home && (team.event_id ?? effectiveEventId)) {
          const eid = Number(team.event_id ?? effectiveEventId);
          const tid = Number(team.id);
          try {
            if ((gpsCfg as any).source === 'ic2') {
              await home.gpsCreateBinding({
                event_id: eid,
                team_id: tid,
                ic2_credential_id: Number((gpsCfg as any).ic2_credential_id),
                device_id: Number((gpsCfg as any).device_id),
                label: (gpsCfg as any).label,
              });
            } else {
              await home.gpsLiveForTeam(eid, tid, { ...(gpsCfg as any), save: true });
            }
          } catch (err) {
            console.warn('[EditTeam] gps bind failed', err);
            notifyGpsBindError(err);
          }
        }

        await overlayPing(team.event_id ?? effectiveEventId);
      } else {
        // INSERT team
        const payload = compact({ event_id: effectiveEventId, team_name: teamPayload.team_name, vehicle_number: teamPayload.vehicle_number, primary_vehicle: teamPayload.primary_vehicle });
        const res = await db.insertData({ tableName: 'event_team', data: payload });
        const row = (Array.isArray(res?.data) ? res.data[0] : res?.data) ?? payload;
        saved = { ...(row as RosterRow) };
        // Insert all competitors now
        if (saved?.id) {
          const ids = await upsertCompetitorsReturnIds(competitorsDraft);
          let pos = 1;
          for (const cid of ids) {
            const draft = competitorsDraft[pos - 1];
            await db.insertData({ tableName: 'event_team_competitors', data: { team_id: saved.id, competitor_id: cid, role: draft?.role ?? null, position: pos++ } });
          }
        }

        // Auto-bond on create if GPS provided
        if (gpsCfg && home && saved?.id && effectiveEventId) {
          try {
            if ((gpsCfg as any).source === 'ic2') {
              await home.gpsCreateBinding({
                event_id: Number(effectiveEventId),
                team_id: Number(saved.id),
                ic2_credential_id: Number((gpsCfg as any).ic2_credential_id),
                device_id: Number((gpsCfg as any).device_id),
                label: (gpsCfg as any).label,
              });
            } else {
              await home.gpsLiveForTeam(Number(effectiveEventId), Number(saved.id), { ...(gpsCfg as any), save: true });
            }
          } catch (err) {
            console.warn('[EditTeam] gps bind failed', err);
            notifyGpsBindError(err);
          }
        }

        await overlayPing(effectiveEventId);
      }

      onUpdated?.(saved);

      // Reset after create (keep selected source)
      if (!isEdit) {
        setFormFields(prev =>
          prev.map(f => {
            if (['gps_source'].includes(f.name)) return f;
            return { ...f, value: '' };
          })
        );
        setCompetitorsDraft([]);
      }
    } catch (err) {
      console.error('Error saving team:', err);
      setNotification?.({
        active: true,
        persistence: 3000,
        dismissable: true,
        list: [{ label: 'Team save failed', message: 'Could not save team. Please try again.' }],
      });
    }
  };

  /* ========= Delete ========= */

  const canDelete = isEdit && team?.id;
  const handleDelete = useCallback(async () => {
    if (!team?.id) return;
    try {
      await db.deleteData({ tableName: 'event_team', where: { exact: { id: team.id } } });
      await overlayPing(team.event_id ?? effectiveEventId);
      onUpdated?.();
    } catch (e) {
      console.error('[EditTeam] delete failed', e);
    }
  }, [db, team?.id, team?.event_id, effectiveEventId, onUpdated]);

  const formatCoord = useCallback((value?: string | number | null) => {
    if (value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(5);
  }, []);

  const lastFix = gpsBinding?.last_fix;
  const lastFixCoords =
    lastFix && formatCoord(lastFix.lat) && formatCoord(lastFix.lon)
      ? `${formatCoord(lastFix.lat)}, ${formatCoord(lastFix.lon)}`
      : null;
  const lastFixTimestamp =
    lastFix?.timestamp != null
      ? (() => {
        const date = new Date(String(lastFix.timestamp));
        return Number.isFinite(date.getTime()) ? date.toLocaleString() : null;
      })()
      : null;

  return (
    <>
      <style jsx>{styles}</style>
      <UiCollapse label="choose from previous teams">
        <div className="prev-teams s-w-100 " style={{ marginBottom: 16 }}>
          <div className="prev-teams__header">
            <div className="prev-teams__title">Previous teams</div>
            <div className="prev-teams__search">
              <UiInput
                name="search"
                placeholder="Search name, number, competitor…"
                value={search}
                onChange={(e: any) => setSearch(e?.target?.value ?? '')}
              />
            </div>
          </div>

          <div className="prev-teams__table">
            {prevLoading ? (
              <div style={{ padding: 8, opacity: 0.7 }}>Loading…</div>
            ) : (prevTeamsRows?.length ?? 0) > 0 ? (
              <AdapTable
                // variant="mini"
                // options={{
                //   tableTitle:<>
                //   </>
                // }}
                data={prevTeamsRows}
                onRowClick={(row: any) => {
                  const match = (filteredPrevTeams ?? []).find(
                    t => String(t.id ?? keyForTeam(t)) === String(row?.id)
                  );
                  if (match) prefillFrom(match);
                }}
              />
            ) : (
              <div style={{ padding: 8, opacity: 0.6 }}>No previous teams found.</div>
            )}
          </div>
        </div>
      </UiCollapse>

      <UiForm
        title={title}
        fields={visibleFormFields}
        submitText={isEdit ? 'Update Team' : 'Create Team'}
        onSubmit={handleSubmit}
        onChange={handleFormChange}
      />

      {gpsSource === 'ic2' && (
        <div style={{ marginTop: 8 }}>
          {credentials.length > 0 && !showCredsManager && (
            <UiButton variant="flat" onClick={() => setShowCredsManager(true)}>
              Manage IC2 Credentials
            </UiButton>
          )}
          {(credentials.length === 0 || showCredsManager) && (
            <div style={{ marginTop: 8 }}>
              <CanopyIc2CredentialsForm
                initialMode={showCredsManager && credentials.length > 0 ? 'list' : 'add'}
                onChanged={(list) => {
                  // Diff before updating so we can find the added credential.
                  const prevIds = new Set(credentials.map((c: IIc2Credential) => String(c.id)));
                  const added = list.find((c: IIc2Credential) => !prevIds.has(String(c.id)));
                  handleCredsChanged(list);
                  if (added) {
                    setShowCredsManager(false);
                    const credValue = String(added.id);
                    setFormFields(prev => prev.map(f =>
                      f.name === 'ic2_credential_id' ? { ...f, value: credValue } : f
                    ));
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {gpsBinding && (
        <div className="gps-binding-info">
          <div className="gps-binding-info__title">
            GPS binding ({(gpsBinding.source ?? 'gps').toUpperCase()})
            {' '}
            {gpsBinding.device_id != null
              ? `device #${gpsBinding.device_id}`
              : gpsBinding.port != null
                ? `port ${gpsBinding.port}`
                : 'bound'}
          </div>
          <div className="gps-binding-info__details">
            {gpsBinding.label && <span>Label: {gpsBinding.label}</span>}
            {lastFixCoords && <span>Last fix: {lastFixCoords}</span>}
            {lastFixTimestamp && <span>Seen: {lastFixTimestamp}</span>}
          </div>
        </div>
      )}

      {/* Competitors editor */}
      <div className="competitors-editor" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Competitors</div>
        {competitorsDraft.map((c, idx) => (
          <div key={idx} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 8, marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <UiInput label="Name" value={c.name}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, name: String(e?.target?.value ?? '') } : x))} />
              <UiInput label="Role (optional)" value={c.role ?? ''}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, role: String(e?.target?.value ?? '') } : x))} />
              <UiInput label="Email" value={c.email ?? ''}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, email: String(e?.target?.value ?? '') } : x))} />
              <UiInput label="Phone" value={c.phone ?? ''}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, phone: String(e?.target?.value ?? '') } : x))} />
              <UiInput label="Image URL" value={c.img_url ?? ''}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, img_url: String(e?.target?.value ?? '') } : x))} />
              <UiInput label="Preferred locales (CSV)" value={c.preferred_locales ?? ''}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, preferred_locales: String(e?.target?.value ?? '') } : x))} />
              <UiInput label="Wins (CSV)" value={c.wins ?? ''}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, wins: String(e?.target?.value ?? '') } : x))} />
              <UiInput label="Attended (CSV)" value={c.attended ?? ''}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, attended: String(e?.target?.value ?? '') } : x))} />
            </div>
            <UiInput label="Description" value={c.description ?? ''}
              onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, description: String(e?.target?.value ?? '') } : x))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
              <UiInput label="Address (JSON)" value={c.addressText ?? ''}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, addressText: String(e?.target?.value ?? '') } : x))} />
              <UiInput label="Metadata (JSON)" value={c.metadataText ?? ''}
                onChange={(e: any) => setCompetitorsDraft(prev => prev.map((x, i) => i === idx ? { ...x, metadataText: String(e?.target?.value ?? '') } : x))} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <UiButton variant="flat" onClick={() => setCompetitorsDraft(prev => {
                if (idx <= 0) return prev;
                const copy = [...prev];
                const [it] = copy.splice(idx, 1);
                copy.splice(idx - 1, 0, it);
                return copy;
              })}>↑</UiButton>
              <UiButton variant="flat" onClick={() => setCompetitorsDraft(prev => {
                if (idx >= prev.length - 1) return prev;
                const copy = [...prev];
                const [it] = copy.splice(idx, 1);
                copy.splice(idx + 1, 0, it);
                return copy;
              })}>↓</UiButton>
              <UiButton  variant="danger" onClick={() => setCompetitorsDraft(prev => prev.filter((_, i) => i !== idx))}>Remove</UiButton>
            </div>
          </div>
        ))}
        <UiButton variant="flat" onClick={() => setCompetitorsDraft(prev => [...prev, { name: '' }])}>
          + Add competitor
        </UiButton>
      </div>

      {canDelete && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <UiButton variant="danger" onClick={handleDelete}>
            Delete Team
          </UiButton>
        </div>
      )}
    </>
  );
};

export default AdminLiveStreamEditTeam;
