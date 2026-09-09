// Toggleable host services — the frontend mirror of the backend catalog
// (mindburn/routes/views/system/mixins/host_services.py). A service runs on
// a device when system_hosts.services.<flag> is true; that flag activates a
// compose profile on the device's next reconcile (role-apply, self-update,
// reboot, `mindburn -update-all`). The DB row is the single source of truth.

export type ServiceParam = {
    key: string;            // services JSONB key, e.g. kiosk_url
    label: string;
    required?: boolean;     // must be set before the service can spin up
    secret?: boolean;       // render as password input
    placeholder?: string;
};

export type ToggleableService = {
    flag: string;               // services JSONB boolean, e.g. wyze_bridge
    label: string;
    profile: string;            // compose profile the flag activates
    composeServices: string[];  // compose service names the profile runs
    params: ServiceParam[];
    note?: string;              // shown in the config panel
};

export const TOGGLEABLE_SERVICES: ToggleableService[] = [
    {
        flag: 'wyze_bridge',
        label: 'Wyze Bridge',
        profile: 'wyze',
        composeServices: ['wyze-bridge'],
        params: [],
        note: 'Camera credentials (WYZE_API_ID / WYZE_API_KEY …) are read from the '
            + "device's local .pi5env — make sure they exist on the target device.",
    },
    {
        flag: 'kiosk',
        label: 'Kiosk Display',
        profile: 'kiosk',
        composeServices: ['kiosk'],
        params: [
            { key: 'kiosk_url', label: 'Kiosk URL', required: true, placeholder: 'deepturn.com/live?event=…' },
            { key: 'kiosk_zoom', label: 'Zoom' },
            { key: 'kiosk_width', label: 'Width' },
            { key: 'kiosk_height', label: 'Height' },
            { key: 'kiosk_rotation', label: 'Rotation' },
        ],
    },
    {
        flag: 'fileserver',
        label: 'File Server (HTTP + SMB)',
        profile: 'fileserver',
        composeServices: ['fileserver', 'samba'],
        params: [
            { key: 'fileserver_path', label: 'Host Path', required: true, placeholder: '/mnt/fileserver' },
            { key: 'smb_user', label: 'SMB User' },
            { key: 'smb_pass', label: 'SMB Password', secret: true },
            { key: 'smb_share', label: 'SMB Share Name' },
        ],
    },
    {
        flag: 'hermes',
        label: 'Hermes Agent (+ Ollama, GPU only)',
        profile: 'hermes',
        composeServices: ['hermes', 'ollama'],
        params: [],
        note: 'Nous Research agent with a local Ollama backend. Ollama carries an '
            + 'NVIDIA reservation — enable only on orchestrators with a GPU '
            + '(e.g. mb1-orch-1). Model, dashboard auth and chat-platform secrets '
            + "are read from the device's .env / data/hermes.",
    },
];

export const serviceByFlag = (flag?: string): ToggleableService | undefined =>
    TOGGLEABLE_SERVICES.find(s => s.flag === flag);

/** Match a docker inventory row (compose service or container name) back to
 *  its toggleable service, when it has one. Core containers return undefined. */
export const serviceForContainer = (ct: { name?: string; service?: string }): ToggleableService | undefined =>
    TOGGLEABLE_SERVICES.find(s =>
        (ct.service && s.composeServices.includes(ct.service)) ||
        (ct.name && s.composeServices.includes(ct.name)),
    );

export type DockerServiceRow = {
    name: string;
    service: string;
    status: string;
    running: boolean;
    flag?: string;          // set for toggleable rows
    enabled?: boolean;      // DB desired state (toggleable rows only)
    toggleable: boolean;
};

/** Union of the live container inventory and the toggleable-service catalog,
 *  so a disabled service (whose container was removed) still has a row the
 *  operator can click to configure + re-enable.
 *
 *  `services == null` means the DB desired state hasn't loaded (or the fetch
 *  failed) — toggleable rows get `enabled: undefined` so the UI can render an
 *  unknown state instead of a false "disabled" (which read as "stopping…"). */
export function buildDockerRows(
    containers: Array<{ name?: string; service?: string; status?: string }>,
    services: Record<string, any> | null | undefined,
): DockerServiceRow[] {
    const svc = services ?? null;
    const rows: DockerServiceRow[] = (containers || []).map(ct => {
        const t = serviceForContainer(ct);
        const status = String(ct.status ?? 'unknown');
        return {
            name: String(ct.name ?? ct.service ?? '—'),
            service: String(ct.service ?? '—'),
            status,
            running: status.toLowerCase().startsWith('running') || status.toLowerCase().startsWith('up'),
            flag: t?.flag,
            enabled: t && svc ? Boolean(svc[t.flag]) : undefined,
            toggleable: Boolean(t),
        };
    });
    const present = new Set(rows.filter(r => r.flag).map(r => r.flag));
    for (const t of TOGGLEABLE_SERVICES) {
        if (present.has(t.flag)) continue;
        rows.push({
            name: t.composeServices[0],
            service: t.composeServices[0],
            status: 'not deployed',
            running: false,
            flag: t.flag,
            enabled: svc ? Boolean(svc[t.flag]) : undefined,
            toggleable: true,
        });
    }
    return rows;
}

/** Required params still missing a value — enabling is blocked until empty. */
export function missingRequiredParams(
    svc: ToggleableService,
    services: Record<string, any> | null | undefined,
): ServiceParam[] {
    const vals = services ?? {};
    return svc.params.filter(p => p.required && !String(vals[p.key] ?? '').trim());
}
