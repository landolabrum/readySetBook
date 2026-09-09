// Relative Path: ./BluetoothManage.tsx
import React, { useMemo, useState } from 'react';
import styles from './BluetoothManage.scss';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';
import UiBadge from '@webstack/components/UiBadge/UiBadge';
import AdapTable, { TableOptions } from '@webstack/components/AdapTable/views/AdapTable';
import type { BluetoothDeviceRow, DiscoveredCandidate } from '../../../../../../helpers/types';

type ReportedDevice = { name: string; mac: string; kind: string; model?: string; stale?: boolean };

// Every BLE list (discovered / configured / reported) reduces to the same
// three-column shape, so one renderer + one AdapTable config drives them all.
type BtRow = { device: string; meta: string; action: React.ReactNode };

type Props = {
  hostKey: string;
  discovered: DiscoveredCandidate[];
  devices: BluetoothDeviceRow[];
  reported?: ReportedDevice[];
  busy?: boolean;
  onSave: (patch: Record<string, any>) => Promise<void> | void;
  onToggle: (id: number, enabled: boolean) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
};

const emptyForm = (kind = 'victron') => ({ device_kind: kind, name: '', mac: '', advertisement_key: '', model: '' });

const BluetoothManage: React.FC<Props> = ({ hostKey, discovered, devices, reported, busy, onSave, onToggle, onDelete }) => {
  const [form, setForm] = useState(emptyForm());
  const isVictron = form.device_kind === 'victron';
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const onInput = (e: any) => set(e.target.name, e.target.value);
  const canSave = Boolean(form.name.trim()) && (!isVictron || Boolean(form.advertisement_key.trim()));

  const registryMacs = useMemo(
    () => new Set(devices.map((d) => (d.mac || '').toLowerCase()).filter(Boolean)),
    [devices],
  );
  const configuredMacs = useMemo(
    () => new Set<string>([...registryMacs, ...((reported ?? []).map((r) => (r.mac || '').toLowerCase()).filter(Boolean))]),
    [registryMacs, reported],
  );
  // Devices the daemon reports but that aren't in the DB registry yet (e.g. the
  // orchestrator hasn't gained the registry route). Shown read-only.
  const reportedOnly = useMemo(
    () => (reported ?? []).filter((r) => r.mac && !registryMacs.has(r.mac.toLowerCase())),
    [reported, registryMacs],
  );

  const submit = async () => {
    await onSave({ ...form, mac: form.mac.trim() || null, name: form.name.trim() });
    setForm(emptyForm(form.device_kind));
  };

  const addFromCandidate = (c: DiscoveredCandidate) =>
    setForm({
      device_kind: c.kind === 'litime' ? 'litime' : 'victron',
      name: c.name || '', mac: c.mac || '', advertisement_key: '', model: '',
    });

  // ── Shared table config ──────────────────────────────────
  // Header-less list feel; the stacked name/meta lives in one cell so the
  // `action` column keeps its own width. `meta` is a data-only key.
  const tableOptions: TableOptions = useMemo(
    () => ({
      hide: 'header',
      hideColumns: ['meta'],
      renderCell: (key, item: BtRow) =>
        key === 'device' ? (
          <div className="btm__row-main">
            <b>{item.device}</b>
            <span className="btm__meta">{item.meta}</span>
          </div>
        ) : undefined,
    }),
    [],
  );

  const discoveredRows = useMemo<BtRow[]>(
    () =>
      discovered.map((c) => {
        // The daemon already reconciles each candidate against the DB config it
        // pulled, so trust its `configured` flag; fall back to the local
        // registry list (which loads once the orchestrator has the route).
        const added = c.configured === true || configuredMacs.has((c.mac || '').toLowerCase());
        return {
          device: c.name || c.mac,
          meta: `${c.kind} · ${c.mac}${typeof c.rssi === 'number' ? ` · ${c.rssi} dBm` : ''}`,
          action: added ? (
            <UiBadge status="ok" label="added" />
          ) : (
            <UiButton variant="ghost" onClick={() => addFromCandidate(c)} traits={{ afterIcon: { icon: 'fas-plus' } }}>Add</UiButton>
          ),
        };
      }),
    [discovered, configuredMacs],
  );

  const configuredRows = useMemo<BtRow[]>(
    () => [
      ...devices.map((d) => ({
        device: d.name,
        meta: `${d.device_kind} · ${d.mac || 'no MAC'}${d.model ? ` · ${d.model}` : ''}`,
        action: (
          <div className="btm__row-actions">
            <UiButton
              traits={{ afterIcon: { icon: d.enabled ? 'fa-stop':'fa-play' } }}
            variant={d.enabled ? 'ghost' : 'success'} disabled={busy} onClick={() => onToggle(d.id, !d.enabled)}>
              {d.enabled ? 'Disable' : 'Enable'}
            </UiButton>
            <UiButton variant="ghost" disabled={busy} onClick={() => onDelete(d.id)} traits={{ afterIcon: { icon: 'fa-trash-can' } }}>Remove</UiButton>
          </div>
        ),
      })),
      ...reportedOnly.map((r) => ({
        device: r.name,
        meta: `${r.kind} · ${r.mac}${r.model ? ` · ${r.model}` : ''}`,
        action: <UiBadge status={r.stale ? 'warn' : 'ok'} label={r.stale ? 'stale' : 'active'} />,
      })),
    ],
    [devices, reportedOnly, busy, onToggle, onDelete],
  );

  return (
    <>
      <style jsx>{styles}</style>
      <div className="btm">
        {/* ── Discovered nearby ─────────────────────────────── */}
        <div className="btm__section">
          <div className="btm__head">Discovered nearby</div>
          {discoveredRows.length === 0 ? (
            <div className="btm__muted">No BLE devices in range (the host daemon scans continuously).</div>
          ) : (
            <AdapTable data={discoveredRows} options={tableOptions} />
          )}
        </div>

        {/* ── Add / edit ────────────────────────────────────── */}
        <div className="btm__section">
          <div className="btm__head">Add device</div>
          <UiButtonGroup
            variant="bundle"
            btns={[
              { name: 'victron', label: 'Victron', checked: isVictron },
              { name: 'litime', label: 'LiTime', checked: !isVictron },
            ]}
            onSelect={(e: any) => set('device_kind', e?.target?.name || e?.detail?.name || 'victron')}
          />
          <UiInput name="name" label={isVictron ? 'Label' : 'Battery name (L-…)'} value={form.name} onChange={onInput} />
          <UiInput name="mac" label="MAC (optional)" value={form.mac} onChange={onInput} placeholder="AA:BB:CC:DD:EE:FF" />
          {isVictron && (
            <UiInput name="advertisement_key" label="Encryption key (VictronConnect)" value={form.advertisement_key} onChange={onInput} placeholder="32-hex Instant-Readout key" />
          )}
          <UiInput name="model" label="Model (optional)" value={form.model} onChange={onInput} />
          <UiButton disabled={!canSave || busy} busy={busy} onClick={submit} traits={{ afterIcon: { icon: 'fa-floppy-disk' } }}>
            Save to {hostKey}
          </UiButton>
        </div>

        {/* ── Configured ────────────────────────────────────── */}
        <div className="btm__section">
          <div className="btm__head">Configured on this host</div>
          {configuredRows.length === 0 ? (
            <div className="btm__muted">None yet — add one above.</div>
          ) : (
            <AdapTable data={configuredRows} options={tableOptions} />
          )}
        </div>
      </div>
    </>
  );
};

export default BluetoothManage;
