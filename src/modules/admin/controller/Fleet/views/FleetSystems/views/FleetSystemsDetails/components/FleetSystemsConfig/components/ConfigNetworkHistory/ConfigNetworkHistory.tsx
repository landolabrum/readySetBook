// Network history table: chronological log of router/network changes.
import React from 'react';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';

interface NetworkRow {
  id: number;
  observed_at?: string;
  lan_ip?: string;
  wan_ip?: string;
  gateway_ip?: string;
  gateway_mac?: string;
  primary_iface?: string;
  wifi_ssid?: string;
  changed?: boolean;
}

interface Props {
  history: NetworkRow[];
}

const ConfigNetworkHistory: React.FC<Props> = ({ history }) => {
  if (!history.length) {
    return (
      <div style={{ opacity: 0.6, fontSize: '0.85rem', fontStyle: 'italic' }}>No history yet.</div>
    );
  }

  const data = history.map((n) => {
    const observed = n.observed_at ? new Date(n.observed_at).toLocaleString() : '—';
    return {
      observed: n.changed ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <UiIcon icon="fa-circle" color="var(--orange-30)" size={8} /> {observed}
        </span>
      ) : (
        observed
      ),
      lan: n.lan_ip || '—',
      wan: n.wan_ip || '—',
      gateway: n.gateway_ip || '—',
      mac: n.gateway_mac || '—',
      iface: n.primary_iface || '—',
      ssid: n.wifi_ssid || '—',
    };
  });

  return <AdapTable variant="mini" data={data} />;
};

export default ConfigNetworkHistory;
