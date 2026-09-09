// Fleet VPN status — SpeedFusion (IC2) + Cloudflared probes.
// Source: GET /system/vpn/status (mindburn/routes/views/system/mixins/vpn_ctl.py)
import React, { useCallback } from 'react';
import styles from './FleetSystemsVpn.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import UiDetail from '@webstack/components/UiDetail/UiDetail';
import { useFleetSystems } from '../../controller';
import { timeAgo } from '../../helpers/systemUtils';
import { onlineBadge, cfBadge } from '../../helpers/vpnBadges';

type Spoke = {
  id?: number | string;
  name?: string;
  serial?: string;
  product?: string;
  online?: boolean;
  peer_connections?: number | null;
  pepvpn_peers?: number | null;
  last_sync?: string | null;
  firmware?: string | null;
};

type Hub = Spoke & { hub?: boolean };

type CfRow = {
  hostname: string;
  http_status?: number | null;
  latency_ms?: number;
  ok: boolean;
  error?: string;
};

const FleetSystemsVpn: React.FC = () => {
  const { vpnStatus, vpnLoading, loadVpnStatus } = useFleetSystems();

  const sf = vpnStatus?.speedfusion;
  const hub: Hub | null = sf?.hub ?? null;
  const spokes: Spoke[] = Array.isArray(sf?.spokes) ? sf.spokes : [];
  const cf: CfRow[] = Array.isArray(vpnStatus?.cloudflared) ? vpnStatus.cloudflared : [];
  const sourceErr = vpnStatus?.source?.error;
  const ic2Reachable = !!vpnStatus?.source?.ic2_reachable;

  const handleRefresh = useCallback(() => {
    loadVpnStatus();
  }, [loadVpnStatus]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className="fleet-systems-vpn">
        <div className="fleet-systems-vpn__header">
          <div>
            <div className="fleet-systems-vpn__title">Fleet VPN</div>
            {vpnStatus?.generated_at && (
              <div className="fleet-systems-vpn__meta">
                Generated {timeAgo(vpnStatus.generated_at)} ·
                {' '}cache age {vpnStatus.age_seconds ?? 0}s ·
                {' '}IC2 {ic2Reachable ? 'reachable' : 'unreachable'}
              </div>
            )}
          </div>
          <button
            type="button"
            className="fleet-systems-vpn__refresh"
            onClick={handleRefresh}
            disabled={vpnLoading}
            style={{ background: 'transparent', border: '1px solid var(--dark-20)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
          >
            <UiIcon icon={vpnLoading ? 'fa-spinner' : 'fa-rotate'} /> refresh
          </button>
        </div>

        {sourceErr && (
          <div className="fleet-systems-vpn__error">
            <UiIcon icon="fa-triangle-exclamation" /> {String(sourceErr)}
          </div>
        )}

        {/* SpeedFusion section */}
        <div className="fleet-systems-vpn__section">
          <div className="fleet-systems-vpn__section-title">
            <UiIcon icon="fa-shield-halved" /> SpeedFusion (InControl 2)
          </div>

          {!sf && (
            <div className="fleet-systems-vpn__empty">
              {vpnLoading ? 'Loading…' : 'IC2 credentials not configured or not reachable.'}
            </div>
          )}

          {sf && hub && (
            <div className="fleet-systems-vpn__hub">
              <UiDetail
                variant="grid"
                items={[
                  { label: 'Hub', value: hub.name },
                  { label: 'Status', value: onlineBadge(hub.online) },
                  { label: 'Peer connections', value: hub.peer_connections ?? 0 },
                  { label: 'Spokes', value: sf.spoke_count ?? spokes.length },
                  { label: 'Active peer conns', value: sf.active_peer_connections ?? 0 },
                  { label: 'Last sync', value: timeAgo(hub.last_sync) },
                ]}
              />
            </div>
          )}

          {sf && spokes.length > 0 && (
            <AdapTable
              variant="mini"
              data={spokes.map((s) => ({
                spoke: s.name || '—',
                status: onlineBadge(s.online),
                serial: s.serial ? (
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.serial}</span>
                ) : '—',
                product: s.product || '—',
                peer_conns: s.peer_connections ?? 0,
                firmware: s.firmware || '—',
                last_sync: timeAgo(s.last_sync),
              }))}
            />
          )}
        </div>

        {/* Cloudflared section */}
        <div className="fleet-systems-vpn__section">
          <div className="fleet-systems-vpn__section-title">
            <UiIcon icon="fa-cloud" /> Cloudflared admin hostnames
          </div>
          {cf.length === 0 ? (
            <div className="fleet-systems-vpn__empty">
              {vpnLoading ? 'Loading…' : 'No probes configured.'}
            </div>
          ) : (
            <div className="fleet-systems-vpn__cf-grid">
              {cf.map((row) => (
                <div key={row.hostname} className="fleet-systems-vpn__cf-card">
                  <div className="host">{row.hostname}</div>
                  <div className="meta">
                    {cfBadge(row)} · {row.latency_ms ?? '—'} ms
                    {row.error ? ` · ${row.error}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FleetSystemsVpn;
