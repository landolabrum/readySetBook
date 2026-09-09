export type MetricRow = {
    ts: string;
    host_key?: string;
    display_name?: string;
    ssh_ip?: string;
    ssh_wan_ip?: string;
    host_lan_ip?: string;
    // Enriched from system_hosts config at fetch time (see useFleetSystemsNetwork).
    ssh_hostname?: string;   // Cloudflare tunnel address, e.g. ssh-xi1-mbp-2.tiktok.soy
    tailscale_ip?: string;   // Tailscale 100.x address (config ssh_wan_ip)
    cloudflared?: any;       // cloudflared tunnel config (id/name)
    role?: string;           // duty: orchestrator | runner (legacy: main|mac|pi)
    device_class?: string;   // platform class: x86 | mac | pi5 — authoritative for icons
    latitude?: number | null;   // device geolocation (IP-geo or manual override)
    longitude?: number | null;
    geo_source?: string | null; // 'ip' | 'manual'
    owner_user_id?: string | null;
    container_name?: string | null;
    cpu_pct?: number | null;
    mem_pct?: number | null;
    mem_used_bytes?: number | null;
    mem_total_bytes?: number | null;
    gpu_util_pct?: number | null;
    gpu_mem_used_mb?: number | null;
    gpu_mem_total_mb?: number | null;
    disk_root_used_bytes?: number | null;
    disk_root_total_bytes?: number | null;
    net_rx_bytes?: number | null;
    net_tx_bytes?: number | null;
    temps_c?: Record<string, number> | null;
    extra?: {
        peers_connected?: number;
        network_interfaces?: Record<string, string[]>;
        lan_ip?: string;
        wan_ip?: string;
        mac_address?: string | null;   // device's own primary-NIC MAC (stable physical id)
        gpu_name?: string | null;
        docker_containers?: Array<{
            name: string;
            image?: string;
            status?: string;
            service?: string;
        }>;
        docker_state?: 'disabled' | 'socket_missing' | 'socket_permission' | 'client_error' | 'ok_empty' | 'ok';
        docker_error?: string;
        docker_last_checked_ts?: string;
        os_info?: Record<string, string>;
        victron?: VictronSnapshot | null;
        litime?: LitimeSnapshot | null;
        tailscale?: {
            backend_state?: string | null;
            self?: {
                hostname?: string | null;
                dns_name?: string | null;
                ip?: string | null;
                online?: boolean;
                tags?: string[];
                advertised_routes?: string[];
                primary_routes?: string[];
            } | null;
            peer_count?: number;
            peers_online?: number;
            peers?: Array<{
                hostname?: string | null;
                dns_name?: string | null;
                ip?: string | null;
                os?: string | null;
                online?: boolean;
                tags?: string[] | null;
                last_seen?: string | null;
                rx_bytes?: number | null;
                tx_bytes?: number | null;
            }>;
        } | null;
        [key: string]: any;
    } | null;
};

export type HostRow = MetricRow & { host_key: string; display_name: string };

export type RangeKey = 'hour' | 'day';

// Victron SmartSolar MPPT — mirrors the backend SmartSolarReading/VictronSnapshot
// (mindburn/routes/views/system/bluetooth/victron_energy/models.py).
export type SmartSolarReading = {
    name: string;
    mac: string;
    model: string;
    charge_state?: string | null;
    charge_state_code?: number | null;
    error_code?: number | null;
    error?: string | null;
    battery_voltage_v?: number | null;
    battery_current_a?: number | null;
    solar_power_w?: number | null;
    yield_today_wh?: number | null;
    load_current_a?: number | null;
    rssi?: number | null;
    last_seen?: string | null;
    stale?: boolean;
};

// A nearby BLE device the host daemon saw (feeds the "scan to add" UI).
export type DiscoveredCandidate = {
    name?: string | null;
    mac: string;
    rssi?: number | null;
    kind: 'victron' | 'litime' | string;
    configured?: boolean;
};

// A configured row from the bluetooth_devices registry.
export type BluetoothDeviceRow = {
    id: number;
    host_key: string;
    device_kind: 'victron' | 'litime' | string;
    name: string;
    mac?: string | null;
    advertisement_key?: string | null;
    model?: string | null;
    enabled: boolean;
    notes?: string | null;
};

export type VictronSnapshot = {
    available: boolean;
    reason?: string | null;
    scanning?: boolean;
    device_count?: number;
    devices?: SmartSolarReading[];
    discovered?: DiscoveredCandidate[];
    ts?: string | null;
};

// LiTime LiFePO4 battery — mirrors backend LitimeBatteryReading/LitimeSnapshot
// (mindburn/routes/views/system/bluetooth/litime/models.py).
export type LitimeBatteryReading = {
    name: string;
    mac: string;
    model: string;
    voltage_v?: number | null;
    current_a?: number | null;
    power_w?: number | null;
    soc_percent?: number | null;
    remaining_ah?: number | null;
    full_capacity_ah?: number | null;
    cycle_count?: number | null;
    battery_temp_c?: number | null;
    mosfet_temp_c?: number | null;
    cell_voltages_v?: number[];
    min_cell_voltage_v?: number | null;
    max_cell_voltage_v?: number | null;
    cell_voltage_delta_mv?: number | null;
    rssi?: number | null;
    last_seen?: string | null;
    stale?: boolean;
};

export type LitimeSnapshot = {
    available: boolean;
    reason?: string | null;
    scanning?: boolean;
    device_count?: number;
    devices?: LitimeBatteryReading[];
    discovered?: DiscoveredCandidate[];
    ts?: string | null;
};
