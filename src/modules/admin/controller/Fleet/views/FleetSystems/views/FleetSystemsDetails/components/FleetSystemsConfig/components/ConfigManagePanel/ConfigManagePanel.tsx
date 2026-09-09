// Read-only "where to manage" panel — site/router, transports, cloudflared.
import React from 'react';
import styles from './ConfigManagePanel.scss';
import UiDetail, { IUiDetailItem } from '@webstack/components/UiDetail/UiDetail';

interface Props {
  networkAdmin: any | null;
}

const linkOrCode = (url?: string, fallback?: string): React.ReactNode =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
  ) : (
    <code>{fallback || '—'}</code>
  );

const ConfigManagePanel: React.FC<Props> = ({ networkAdmin }) => {
  const cfd = networkAdmin?.cloudflared;
  const site = networkAdmin?.site;
  const transports: any[] = networkAdmin?.transports || [];

  const items: IUiDetailItem[] = [];
  if (site) {
    items.push({
      label: 'Router',
      value: (
        <>{linkOrCode(site.router_admin_url, site.router_lan_ip)} ({site.router_vendor || 'unknown'} @ site {site.site_id})</>
      ),
    });
  }
  transports.forEach((t) => items.push({
    label: t.type,
    value: <>{linkOrCode(t.admin_url, t.transport_id)}{t.notes ? ` — ${t.notes}` : ''}</>,
  }));
  if (cfd?.config_path) items.push({
    label: 'Cloudflared',
    value: <><code>{cfd.config_path}</code>{cfd.tunnel_id ? ` (tunnel ${cfd.tunnel_id})` : ''}</>,
  });
  if (cfd?.credentials_path) items.push({
    label: 'Credentials',
    value: <code>{cfd.credentials_path}</code>,
  });

  return (
    <>
      <style jsx>{styles}</style>
      <div className="config-manage-panel">
        {!site && (
          <div className="config-manage-panel__empty">
            No site assigned. Set <code>site_id</code> above to link this host to a router.
          </div>
        )}
        <UiDetail items={items} />
      </div>
    </>
  );
};

export default ConfigManagePanel;
