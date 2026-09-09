// Relative Path: ./BluetoothTimeline.tsx
import React, { useMemo } from 'react';
import styles from './BluetoothTimeline.scss';
import UiLineGraph from '@webstack/components/Graphs/UiLineGraph/UiLineGraph';
import type { MetricRow, SmartSolarReading, LitimeBatteryReading } from '../../../../../../helpers/types';

// Plots each BLE statistic over the selected range (Hourly/Day — driven by the
// same rangeButtons at the top of FleetSystems, which already range-filter the
// timeline). Each stat that has data becomes its own small line graph; one
// series per device (keyed by MAC), so multiple batteries overlay cleanly.

type Props = { timeline?: MetricRow[]; loading?: boolean };

type Point = { x: number; y: number };

type MetricDef = {
  key: string;
  source: 'victron' | 'litime';
  srcLabel: string;
  label: string;
  unit: string;
  color: string;
  get: (d: any) => number | null | undefined;
};

const METRICS: MetricDef[] = [
  { key: 'v_batt', source: 'victron', srcLabel: 'Victron', label: 'Battery', unit: 'V', color: '#7bdcb5', get: (d: SmartSolarReading) => d.battery_voltage_v },
  { key: 'v_solar', source: 'victron', srcLabel: 'Victron', label: 'Solar power', unit: 'W', color: '#f0ad4e', get: (d: SmartSolarReading) => d.solar_power_w },
  { key: 'v_curr', source: 'victron', srcLabel: 'Victron', label: 'Charge current', unit: 'A', color: '#5bc0de', get: (d: SmartSolarReading) => d.battery_current_a },
  { key: 'l_volt', source: 'litime', srcLabel: 'LiTime', label: 'Voltage', unit: 'V', color: '#7bdcb5', get: (d: LitimeBatteryReading) => d.voltage_v },
  { key: 'l_soc', source: 'litime', srcLabel: 'LiTime', label: 'State of charge', unit: '%', color: '#7f8cfa', get: (d: LitimeBatteryReading) => d.soc_percent },
  { key: 'l_power', source: 'litime', srcLabel: 'LiTime', label: 'Power', unit: 'W', color: '#ff8b94', get: (d: LitimeBatteryReading) => d.power_w },
  { key: 'l_curr', source: 'litime', srcLabel: 'LiTime', label: 'Current', unit: 'A', color: '#5bc0de', get: (d: LitimeBatteryReading) => d.current_a },
];

const seriesForMetric = (timeline: MetricRow[], m: MetricDef) => {
  const byDevice: Record<string, { label: string; points: Point[] }> = {};
  for (const row of timeline) {
    const x = row?.ts ? new Date(row.ts).getTime() : NaN;
    if (!Number.isFinite(x)) continue;
    const devices = ((row.extra as any)?.[m.source]?.devices ?? []) as any[];
    for (const d of devices) {
      const y = m.get(d);
      if (typeof y !== 'number' || !Number.isFinite(y)) continue;
      const key = d.mac || d.name || 'device';
      (byDevice[key] ||= { label: d.name || key, points: [] }).points.push({ x, y });
    }
  }
  return byDevice;
};

const BluetoothTimeline: React.FC<Props> = ({ timeline }) => {
  const cards = useMemo(() => {
    const rows = (timeline ?? []).filter((r) => r?.ts);
    return METRICS.map((m) => {
      const byDevice = seriesForMetric(rows, m);
      const keys = Object.keys(byDevice);
      if (!keys.length) return null;
      const data: Record<string, { points: Point[]; color: string; label: string }> = {};
      keys.forEach((k, i) => {
        data[`${m.key}:${k}`] = {
          points: byDevice[k].points,
          color: m.color,
          label: keys.length > 1 ? byDevice[k].label : '',
        };
      });
      return { m, data };
    }).filter(Boolean) as { m: MetricDef; data: Record<string, { points: Point[]; color: string; label: string }> }[];
  }, [timeline]);

  if (!cards.length) {
    return (
      <>
        <style jsx>{styles}</style>
        <div className="bt-tl__empty">No timeline data yet — readings accrue as the host reports metrics.</div>
      </>
    );
  } 

  return (
    <>
      <style jsx>{styles}</style>
      <div className="bt-tl">
        {cards.map(({ m, data }) => (
          <div className="bt-tl__card card" key={m.key}>
            <div className="bt-tl__head">
              <span className="bt-tl__src">{m.srcLabel}</span>
              {m.label}
              <small>{m.unit}</small>
            </div>
            <div className="bt-tl__graph">
              <UiLineGraph data={data} traits={{ strokeWidth: 2, showDots: false }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default BluetoothTimeline;
