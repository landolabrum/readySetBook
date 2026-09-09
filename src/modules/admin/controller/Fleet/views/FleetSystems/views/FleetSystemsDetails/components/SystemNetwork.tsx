import React from 'react';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';

type Props = { systemData: any; loading?: boolean; };

const SystemNetwork: React.FC<Props> = ({ systemData }) => (
    <>
        <AdapTable
            data={[
                { detail: 'LAN IP', value: systemData?.lan_ip || 'detecting…' },
                { detail: 'WAN IP', value: systemData?.wan_ip || 'detecting…' },
                { detail: 'MAC Address', value: systemData?.mac_address || 'detecting…' },
                { detail: 'Peers Connected', value: `${systemData?.peers_connected ?? 0}` },
                { detail: 'Traffic', value: `RX ${systemData?.net_rx_human ?? '0 B'} • TX ${systemData?.net_tx_human ?? '0 B'}` },
            ]}
            options={{ hide: 'header' as const }}
        />
        {Object.keys(systemData?.network_interfaces || {}).length > 0 && (
            <AdapTable
                data={Object.entries(systemData?.network_interfaces || {}).map(([iface, ips]) => ({
                    interface: iface,
                    addresses: Array.isArray(ips) ? (ips as string[]).join(', ') : String(ips),
                }))}
                options={{ hide: 'header' as const }}
            />
        )}
    </>
);

export default SystemNetwork;
