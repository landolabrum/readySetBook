// Identity / network posture — read-only fields surfaced from the
// system_hosts row. Render-only, no state.
import React from 'react';
import UiDetail from '@webstack/components/UiDetail/UiDetail';

const FIELDS: Array<[string, string]> = [
  ['host_key', 'Host key'],
  ['device_id', 'Device ID'],
  ['lan_ip', 'LAN IP'],
  ['wan_ip', 'WAN IP'],
  ['gateway_ip', 'Gateway IP'],
  ['gateway_mac', 'Gateway MAC'],
  ['mac_address', 'Device MAC'],
  ['primary_iface', 'Primary iface'],
  ['wifi_ssid', 'Wi-Fi SSID'],
];

interface Props {
  config: any | null;
}

const ConfigIdentity: React.FC<Props> = ({ config }) => (
  <UiDetail
    variant="grid"
    items={FIELDS.map(([key, label]) => ({ label, value: config?.[key] }))}
  />
);

export default ConfigIdentity;
