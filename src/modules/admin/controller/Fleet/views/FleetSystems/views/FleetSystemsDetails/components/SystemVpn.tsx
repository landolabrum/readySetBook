import React from 'react';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';

type Props = { systemData: any; loading?: boolean; };

const SystemVpn: React.FC<Props> = ({ systemData }) => {
    const ts = systemData?.tailscale as any;
    if (!ts) {
        return (
            <AdapTable
                data={[{ detail: 'Tailscale', value: 'not installed' }]}
                options={{ hide: 'header' as const }}
            />
        );
    }
    const self = ts.self || {};
    const online = !!self.online;
    const peers = Array.isArray(ts.peers) ? ts.peers : [];
    return (
        <>
            <AdapTable
                data={[
                    { detail: 'Backend', value: ts.backend_state || 'unknown' },
                    { detail: 'Self', value: `${self.dns_name || self.hostname || '—'} (${self.ip || 'no ip'})` },
                    { detail: 'Status', value: online ? 'online' : 'offline' },
                    { detail: 'Peers', value: `${ts.peers_online ?? 0} / ${ts.peer_count ?? 0} online` },
                    ...(Array.isArray(self.advertised_routes) && self.advertised_routes.length
                        ? [{ detail: 'Advertised routes', value: self.advertised_routes.join(', ') }]
                        : []),
                    ...(Array.isArray(self.primary_routes) && self.primary_routes.length
                        ? [{ detail: 'Primary routes', value: self.primary_routes.join(', ') }]
                        : []),
                ]}
                options={{ hide: 'header' as const }}
            />
            {peers.length > 0 && (
                <AdapTable
                    data={peers.map((p: any) => ({
                        peer: p.hostname || p.dns_name || '—',
                        ip: p.ip || '—',
                        os: p.os || '—',
                        status: p.online ? 'online' : 'offline',
                    }))}
                />
            )}
        </>
    );
};

export default SystemVpn;
