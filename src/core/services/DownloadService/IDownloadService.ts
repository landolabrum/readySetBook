import { DeviceClass, IDownloadTarget } from "~/src/modules/download/models/IDownloadTarget";

export interface IDownloadEntitlementRequest {
  // Deprecated: identity now comes from the login JWT server-side.
  customerId?: string;
  deviceClass: DeviceClass;
}

export interface IDownloadEntitlement {
  token?: string;       // short-lived signed entitlement JWT
  expiresAt?: string;   // ISO expiry, when the server provides it
  entitled?: boolean;   // server confirms the gate in the same call
}

export default interface IDownloadService {
  // Public listing — no secrets, no token.
  getTargets(): Promise<IDownloadTarget[]>;
  // Authed — server re-checks the Stripe subscription before minting a token.
  mintEntitlement(request: IDownloadEntitlementRequest): Promise<IDownloadEntitlement>;
}
