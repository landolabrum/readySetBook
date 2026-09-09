import { encryptString } from "@webstack/helpers/Encryption";
import ApiService from "../ApiService";

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION?.trim();

/**
 * System / fleet-administration slice of the admin API surface:
 * device metrics + docker control, DB-backed device config
 * (system_hosts), fleet config (system_config) and GPIO.
 *
 * AdminService extends this class — commerce/customer/product methods
 * live there, keeping both files small and single-purpose.
 */
export default abstract class FleetService extends ApiService {
  // SYSTEM
  public async getSystemInfo(): Promise<any> {
    try {
      return await this.get<any>(`/system/`);
    } catch (error: any) {
      return error;
    }
  }

  public async getVpnStatus(): Promise<any> {
    try {
      return await this.get<any>(`/system/vpn/status`);
    } catch (error: any) {
      return error;
    }
  }

  // DOCKER
  public async getDockerPs(): Promise<any> {
    try {
      return await this.get<any>(`/system/docker/ps`);
    } catch (error: any) {
      return error;
    }
  }

  public async restartDocker(targetHostKey?: string): Promise<any> {
    try {
      return await this.post<any, any>(`/system/docker/restart`, { targetHostKey });
    } catch (error: any) {
      return error;
    }
  }

  public async updateDevice(targetHostKey?: string): Promise<any> {
    try {
      return await this.post<any, any>(`/system/docker/update`, { targetHostKey });
    } catch (error: any) {
      return error;
    }
  }

  public async updateAll(scope: 'host' | 'workers' | 'all' = 'all'): Promise<any> {
    try {
      return await this.post<any, any>(`/system/docker/update-all`, { scope });
    } catch (error: any) {
      return error;
    }
  }

  public async getHeadlessStatus(targetHostKey?: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (targetHostKey) params.set('targetHostKey', targetHostKey);
      const query = params.toString();
      return await this.get<any>(`/system/docker/headless-status${query ? `?${query}` : ''}`);
    } catch (error: any) {
      return error;
    }
  }

  public async headlessToggle(action: 'enable' | 'revert', targetHostKey?: string): Promise<any> {
    try {
      return await this.post<any, any>(`/system/docker/headless`, { action, targetHostKey });
    } catch (error: any) {
      return error;
    }
  }

  // DEVICE CONFIG (DB-backed system_hosts)
  public async listDeviceConfigs(): Promise<any> {
    try {
      return await this.get<any>(`/system/hosts`);
    } catch (error: any) {
      return error;
    }
  }

  public async getDeviceConfig(hostKey: string): Promise<any> {
    try {
      return await this.get<any>(`/system/hosts/${encodeURIComponent(hostKey)}`);
    } catch (error: any) {
      return error;
    }
  }

  public async updateDeviceConfig(hostKey: string, patch: Record<string, any>): Promise<any> {
    try {
      const encrypted = encryptString(JSON.stringify(patch), ENCRYPTION_KEY);
      const body = encrypted ? { data: encrypted } : patch;
      return await this.patch<any, any>(
        `/system/hosts/${encodeURIComponent(hostKey)}`,
        body,
      );
    } catch (error: any) {
      return error;
    }
  }

  /**
   * Flip one system_hosts.services flag (wyze_bridge | kiosk | fileserver)
   * and ask the device agent to reconcile its container set immediately.
   * The DB row stays the source of truth either way — a device that can't
   * be reached converges on its next self-update tick or update-all.
   */
  public async toggleHostService(hostKey: string, serviceKey: string, enabled: boolean): Promise<any> {
    try {
      return await this.post<any, any>(
        `/system/hosts/${encodeURIComponent(hostKey)}/services/${encodeURIComponent(serviceKey)}`,
        { enabled },
      );
    } catch (error: any) {
      return error;
    }
  }

  // BLUETOOTH DEVICES (DB-backed bluetooth_devices registry). The host's BLE
  // daemon pulls this same registry; the DB row is the source of truth.
  public async listBluetoothDevices(hostKey: string): Promise<any> {
    try {
      return await this.get<any>(`/system/bluetooth/devices?host_key=${encodeURIComponent(hostKey)}`);
    } catch (error: any) {
      return error;
    }
  }

  public async upsertBluetoothDevice(device: Record<string, any>): Promise<any> {
    try {
      return await this.post<any, any>(`/system/bluetooth/devices`, device);
    } catch (error: any) {
      return error;
    }
  }

  public async setBluetoothDeviceEnabled(id: number, enabled: boolean): Promise<any> {
    try {
      return await this.post<any, any>(`/system/bluetooth/devices/${id}/enabled`, { enabled });
    } catch (error: any) {
      return error;
    }
  }

  public async deleteBluetoothDevice(id: number): Promise<any> {
    try {
      return await this.delete<any>(`/system/bluetooth/devices/${id}`);
    } catch (error: any) {
      return error;
    }
  }

  public async getDeviceNetworkHistory(hostKey: string, limit = 50): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      return await this.get<any>(
        `/system/hosts/${encodeURIComponent(hostKey)}/networks?${params.toString()}`,
      );
    } catch (error: any) {
      return error;
    }
  }

  public async refreshDeviceNetwork(hostKey: string): Promise<any> {
    try {
      return await this.post<any, any>(
        `/system/hosts/${encodeURIComponent(hostKey)}/refresh-network`,
        {},
      );
    } catch (error: any) {
      return error;
    }
  }

  public async pushKioskUrl(hostKey: string, url: string): Promise<any> {
    try {
      return await this.post<any, any>(
        `/system/hosts/${encodeURIComponent(hostKey)}/kiosk-url`,
        { url },
      );
    } catch (error: any) {
      return error;
    }
  }

  public async getNetworkAdminPanel(hostKey: string): Promise<any> {
    try {
      return await this.get<any>(
        `/system/hosts/${encodeURIComponent(hostKey)}/network-admin`,
      );
    } catch (error: any) {
      return error;
    }
  }

  public async revealDeviceSecret(hostKey: string, secretKey: string): Promise<any> {
    try {
      return await this.get<any>(
        `/system/hosts/${encodeURIComponent(hostKey)}/secrets/${encodeURIComponent(secretKey)}`,
      );
    } catch (error: any) {
      return error;
    }
  }

  // FLEET CONFIG (DB-backed system_config)
  public async listFleetConfig(): Promise<any> {
    try {
      return await this.get<any>(`/system/config`);
    } catch (error: any) {
      return error;
    }
  }

  public async revealFleetSecret(name: string): Promise<any> {
    try {
      return await this.get<any>(`/system/config/secrets/${encodeURIComponent(name)}`);
    } catch (error: any) {
      return error;
    }
  }

  public async upsertFleetConfig(key: string, value: any): Promise<any> {
    try {
      const payload = { value };
      const encrypted = encryptString(JSON.stringify(payload), ENCRYPTION_KEY);
      const body = encrypted ? { data: encrypted } : payload;
      return await this.put<any, any>(`/system/config/${encodeURI(key)}`, body);
    } catch (error: any) {
      return error;
    }
  }

  public async deleteFleetConfig(key: string): Promise<any> {
    try {
      return await this.delete<any>(`/system/config/${encodeURI(key)}`);
    } catch (error: any) {
      return error;
    }
  }

  // GPIO
  public async getGpioStatus(targetHostKey: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.set('targetHostKey', targetHostKey);
      return await this.get<any>(`/system/gpio/status?${params.toString()}`);
    } catch (error: any) {
      return error;
    }
  }

  public async setGpioRelay(targetHostKey: string, relay_id: number, on: boolean): Promise<any> {
    try {
      return await this.post<any, any>(`/system/gpio/set`, { targetHostKey, relay_id, on });
    } catch (error: any) {
      return error;
    }
  }

  public async applyGpioConfig(targetHostKey: string): Promise<any> {
    try {
      return await this.post<any, any>(`/system/gpio/apply`, { targetHostKey });
    } catch (error: any) {
      return error;
    }
  }
}
