// Relative Path: ./SystemBluetooth.tsx
import React, { useMemo, useState } from 'react';
import styles from './SystemBluetooth.scss';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import UiBadge from '@webstack/components/UiBadge/UiBadge';
import type { MetricRow, SmartSolarReading, LitimeBatteryReading, DiscoveredCandidate } from '../../../../../helpers/types';
import UiRadioLayout, { UiRadioLayoutView } from '@webstack/layouts/UiRadioLayout/controller/UiRadioLayout';
import BluetoothTimeline from '../views/BluetoothTimeline/BluetoothTimeline';
import BluetoothManage from '../views/BluetoothManage/BluetoothManage';
import { useFleetSystems } from '../../../../../controller';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';

// One BLE panel for every Bluetooth telemetry source on a host (Victron
// SmartSolar, LiTime battery, ...). Each device becomes a labeled section of a
// single AdapTable: a bold header row (name + model + live/stale badge) followed
// by its detail/value rows. Replaces the former per-device sub-components.

type Props = { systemData?: any; timeline?: MetricRow[]; loading?: boolean };
type Row = { detail: string; value: string };

const n = (v: unknown, unit: string, digits = 1) =>
  typeof v === 'number' ? `${v.toFixed(digits)}${unit}` : 'n/a';

const victronRows = (d: SmartSolarReading): Row[] => [
  { detail: 'Charge state', value: d.charge_state ? d.charge_state.replace(/_/g, ' ') : 'n/a' },
  { detail: 'Battery', value: n(d.battery_voltage_v, ' V', 2) },
  { detail: 'Charge current', value: n(d.battery_current_a, ' A', 1) },
  { detail: 'Solar power', value: n(d.solar_power_w, ' W', 0) },
  { detail: 'Yield today', value: n(d.yield_today_wh, ' Wh', 0) },
  ...(typeof d.load_current_a === 'number' ? [{ detail: 'Load current', value: n(d.load_current_a, ' A', 1) }] : []),
  { detail: 'Signal', value: typeof d.rssi === 'number' ? `${d.rssi} dBm` : 'n/a' },
  ...(d.error ? [{ detail: 'Error', value: d.error.replace(/_/g, ' ') }] : []),
];

const litimeRows = (d: LitimeBatteryReading): Row[] => [
  { detail: 'Voltage', value: n(d.voltage_v, ' V', 3) },
  { detail: 'Current', value: n(d.current_a, ' A', 2) },
  { detail: 'Power', value: n(d.power_w, ' W', 1) },
  { detail: 'State of charge', value: typeof d.soc_percent === 'number' ? `${d.soc_percent}%` : 'n/a' },
  { detail: 'Remaining', value: `${n(d.remaining_ah, ' Ah', 2)}${typeof d.full_capacity_ah === 'number' ? ` / ${d.full_capacity_ah.toFixed(2)} Ah` : ''}` },
  { detail: 'Battery temp', value: typeof d.battery_temp_c === 'number' ? `${d.battery_temp_c}°C` : 'n/a' },
  { detail: 'MOSFET temp', value: typeof d.mosfet_temp_c === 'number' ? `${d.mosfet_temp_c}°C` : 'n/a' },
  { detail: 'Cycles', value: typeof d.cycle_count === 'number' ? String(d.cycle_count) : 'n/a' },
  ...(Array.isArray(d.cell_voltages_v) && d.cell_voltages_v.length
    ? [{ detail: 'Cells', value: d.cell_voltages_v.map((v) => v.toFixed(3)).join(', ') + ' V' }] : []),
  ...(typeof d.cell_voltage_delta_mv === 'number' ? [{ detail: 'Cell delta', value: `${d.cell_voltage_delta_mv} mV` }] : []),
  { detail: 'Signal', value: typeof d.rssi === 'number' ? `${d.rssi} dBm` : 'n/a' },
];

type Section = { title: string; model: string; stale: boolean; lastSeen?: string | null; rows: Row[] };

const SystemBluetooth: React.FC<Props> = ({ systemData, timeline, loading }) => {
  const {
    selectedHostKey, bluetoothDevices, bluetoothBusy,
    saveBluetoothDevice, toggleBluetoothDevice, deleteBluetoothDevice,
  } = useFleetSystems();

  const discovered = useMemo<DiscoveredCandidate[]>(() => ([
    ...((systemData?.victron?.discovered ?? []) as DiscoveredCandidate[]),
    ...((systemData?.litime?.discovered ?? []) as DiscoveredCandidate[]),
  ]), [systemData]);

  // Devices the daemon is actively reading = the configured set, with live data.
  // Used as a fallback so the "Configured" list isn't empty before the
  // orchestrator gains the registry route (after deploy it merges with the DB rows).
  const reported = useMemo(() => ([
    ...((systemData?.victron?.devices ?? []) as SmartSolarReading[]).map((d) => ({ name: d.name, mac: (d.mac || '').toLowerCase(), kind: 'victron', model: d.model, stale: d.stale !== false })),
    ...((systemData?.litime?.devices ?? []) as LitimeBatteryReading[]).map((d) => ({ name: d.name, mac: (d.mac || '').toLowerCase(), kind: 'litime', model: d.model, stale: d.stale !== false })),
  ]), [systemData]);
  const { data, headers } = useMemo(() => {
    const sections: Section[] = [];
    for (const d of (systemData?.victron?.devices ?? []) as SmartSolarReading[])
      sections.push({ title: d.name, model: d.model, stale: d.stale !== false, lastSeen: d.last_seen, rows: victronRows(d) });
    for (const d of (systemData?.litime?.devices ?? []) as LitimeBatteryReading[])
      sections.push({ title: d.name, model: d.model, stale: d.stale !== false, lastSeen: d.last_seen, rows: litimeRows(d) });

    const rows: Row[] = [];
    const headers = new Map<number, { model: string; stale: boolean }>();
    sections.forEach((s) => {
      headers.set(rows.length, { model: s.model, stale: s.stale });
      rows.push({ detail: s.title, value: s.stale ? 'stale' : 'live' });
      s.rows.forEach((r) => rows.push(r));
      if (s.lastSeen) rows.push({ detail: 'Last seen', value: new Date(s.lastSeen).toLocaleString() });
    });
    return { data: rows, headers };
  }, [systemData]);

  const renderCell = (key: string, item: Row, rowIndex: number): React.ReactNode => {
    const head = headers.get(rowIndex);
    if (!head) return undefined;
    if (key === 'detail')
      return (
        <span className="bt__title"><b>{item.detail}</b><span className="bt__model">{head.model}</span></span>
      );
    if (key === 'value')
      return <UiBadge status={head.stale ? 'warn' : 'ok'} label={head.stale ? 'stale' : 'live'} />;
    return undefined;
  };

  // const shouldOnboard = Boolean(data.length > 0);

  const views:UiRadioLayoutView[] = [
      {
        id: 'table',
        navigation: { icon: 'fa-table' },
        content: (
          <AdapTable
            loading={loading}
            data={data}
            options={{ hide: ['header', 'footer'] as ['header', 'footer'], externalPagination: true, renderCell }}
          />
        ),
      },
      {
        id: 'timeline',
        navigation: { icon: 'fa-chart-line' },
        content: <BluetoothTimeline timeline={timeline} loading={loading} />,
      },
    {
      id: 'manage',
      navigation: { icon: 'fa-gear' },

      content: (
        <BluetoothManage
          hostKey={selectedHostKey}
          discovered={discovered}
          devices={bluetoothDevices}
          reported={reported}
          busy={bluetoothBusy}
          onSave={saveBluetoothDevice}
          onToggle={toggleBluetoothDevice}
          onDelete={deleteBluetoothDevice}
        />
      ),
    }
  ];

  return (
    <>
      <style jsx>{styles}</style>
      <div className="bt">
        <UiRadioLayout
          // defaultValue={shouldOnboard && 'manage'||undefined}
          collapsed={false}
         views={views} />
      </div>
    </>
  );
};

export default SystemBluetooth;
