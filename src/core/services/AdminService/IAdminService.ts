import IAuthenticatedUser from "~/src/models/ICustomer";
import { IAccountsResponse } from "./adminModels/iAdminAccounts";

export interface IFlipperStatus {
  success: boolean;
  connected: boolean;
  mode?: string;
  detail?: string;
}

export interface IFlipperActionResponse {
  success: boolean;
  mode?: string;
  detail?: string;
  [key: string]: any;
}

export interface IFlipperSavedSub {
  payload: string;
  repeat?: number;
  savedAt?: number;
  name?: string;
  source?: string;
  path?: string;
  size?: number;
}

export interface IFlipperSavedResponse {
  items: IFlipperSavedSub[];
}

export interface IRemoteAccessResponse {
  status: "success" | "error";
  message: string;
}
export default interface IAdminService {
  // CUSTOMERS
  getCustomer(customerId: string): Promise<any>;
  getPrice(priceId: string): Promise<any>;
  createCustomer(customer: any): Promise<any>;
  listCustomers(page?: number, perPage?: number, search?: string): Promise<any>;
  deleteCustomers(deleteCustomers: string[]): Promise<any>;
  updateCustomer(customer: IAuthenticatedUser): Promise<any>;
  // PRODUCTS
  deleteProduct(productId: string, price_id?: string): Promise<any>;
  deletePrice(priceId: string): Promise<any>;
  createProduct(productData: any): Promise<any>;
  setupRemoteAccess(): Promise<IRemoteAccessResponse>;
  listAccounts(): Promise<IAccountsResponse>;
  getAccount(accountId: string): Promise<any>;
  // SYSTEM
  getSystemInfo(): Promise<any>;
  getVpnStatus(): Promise<any>;
  // DOCKER
  getDockerPs(): Promise<any>;
  restartDocker(targetHostKey?: string): Promise<any>;
  updateDevice(targetHostKey?: string): Promise<any>;
  updateAll(scope: 'host' | 'workers' | 'all'): Promise<any>;
  getHeadlessStatus(targetHostKey?: string): Promise<any>;
  headlessToggle(action: 'enable' | 'revert', targetHostKey?: string): Promise<any>;
  // DEVICE CONFIG (DB-backed system_hosts)
  listDeviceConfigs(): Promise<any>;
  getDeviceConfig(hostKey: string): Promise<any>;
  updateDeviceConfig(hostKey: string, patch: Record<string, any>): Promise<any>;
  toggleHostService(hostKey: string, serviceKey: string, enabled: boolean): Promise<any>;
  // BLUETOOTH DEVICES (DB-backed bluetooth_devices registry)
  listBluetoothDevices(hostKey: string): Promise<any>;
  upsertBluetoothDevice(device: Record<string, any>): Promise<any>;
  setBluetoothDeviceEnabled(id: number, enabled: boolean): Promise<any>;
  deleteBluetoothDevice(id: number): Promise<any>;
  revealDeviceSecret(hostKey: string, secretKey: string): Promise<any>;
  getDeviceNetworkHistory(hostKey: string, limit?: number): Promise<any>;
  refreshDeviceNetwork(hostKey: string): Promise<any>;
  pushKioskUrl(hostKey: string, url: string): Promise<any>;
  getNetworkAdminPanel(hostKey: string): Promise<any>;
  // FLEET CONFIG (DB-backed system_config)
  listFleetConfig(): Promise<any>;
  revealFleetSecret(name: string): Promise<any>;
  upsertFleetConfig(key: string, value: any): Promise<any>;
  deleteFleetConfig(key: string): Promise<any>;
  // SECURITY
  listThreats(): Promise<any>;
  // GPIO
  getGpioStatus(targetHostKey: string): Promise<any>;
  setGpioRelay(targetHostKey: string, relay_id: number, on: boolean): Promise<any>;
  applyGpioConfig(targetHostKey: string): Promise<any>;
  // FLIPPER
  getFlipperStatus(): Promise<IFlipperStatus>;
  flipperVibrate(payload: { duration?: number }): Promise<IFlipperActionResponse>;
  flipperInfrared(payload: { signal: string; repeat?: number }): Promise<IFlipperActionResponse>;
  flipperSubGhz(payload: { payload: string; repeat?: number; remember?: boolean }): Promise<IFlipperActionResponse>;
  getFlipperSavedSubGhz(): Promise<IFlipperSavedResponse>;
  ingestFlipperSavedSubGhz(): Promise<IFlipperSavedResponse>;
  flipperPushFile(file: File): Promise<IFlipperActionResponse>;
  flipperReboot(): Promise<IFlipperActionResponse>;
}
