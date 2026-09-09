import React from 'react';
import UiBadge from '@webstack/components/UiBadge/UiBadge';

// Presentational badges for the Fleet VPN surfaces (SpeedFusion + Cloudflared).

export const onlineBadge = (online?: boolean): React.ReactNode => <UiBadge status={!!online} />;

type CfBadgeRow = { ok: boolean; http_status?: number | null };

export const cfBadge = (row: CfBadgeRow): React.ReactNode => {
    if (row.ok) return <UiBadge status="ok" icon={false} label={row.http_status ?? 'ok'} />;
    if (row.http_status && row.http_status >= 500) {
        return <UiBadge status="warn" icon={false} label={row.http_status} />;
    }
    return <UiBadge status="bad" icon={false} label={row.http_status ?? 'fail'} />;
};
