import { IFormField } from '@webstack/components/UiForm/models/IFormModel';

// Flat text fields — share one UiForm + save button.
export const TEXT_FIELDS: Array<IFormField> = [
  { width: '50%', name: 'display_name',    label: 'Display Name' },
  { width: '50%', name: 'description',     label: 'Description' },
  { width: '50%', name: 'role',            label: 'Role' },
  { width: '50%', name: 'hostname',        label: 'Hostname (Canonical)' },
  { width: '50%', name: 'dns_host',        label: 'DNS Host' },
  { width: '50%', name: 'env_file',        label: '.Env File' },
  { width: '50%', name: 'ssh_user',        label: 'SSH User' },
  { width: '50%', name: 'ssh_hostname',    label: 'SSH Hostname' },
  { width: '50%', name: 'ssh_ip',          label: 'SSH IP (LAN)' },
  { width: '50%', name: 'ssh_wan_ip',      label: 'SSH IP (WAN)' },
  { width: '50%', name: 'workdir',         label: 'Working Dir' },
  { width: '50%', name: 'compose_file',    label: 'Compose File' },
  { width: '50%', name: 'compose_project', label: 'Compose Project' },
  { width: '50%', name: 'network_name',    label: 'Docker Network' },
  { width: '50%', name: 'db_host',         label: 'DB Host' },
  { width: '50%', name: 'agent_url',       label: 'Agent URL' },
  { width: '50%', name: 'site_id',         label: 'Site ID' },
];

// JSONB config blobs — each expands its keys into typed inputs in its own UiForm.
export const JSON_FIELDS: Array<{ name: string; label: string }> = [
  { name: 'hostnames',     label: 'Hostnames' },
  { name: 'connectivity',  label: 'Connectivity' },
  { name: 'services',      label: 'Services' },
  { name: 'cloudflared',   label: 'Cloudflared' },
  { name: 'gpio',          label: 'GPIO' },
  { name: 'stream_worker', label: 'Stream Worker' },
  { name: 'metrics_extra', label: 'Metrics Extra' },
];
