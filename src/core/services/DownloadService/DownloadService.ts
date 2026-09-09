import ApiService from "../ApiService";
import environment from "~/src/core/environment";
import IDownloadService, {
  IDownloadEntitlement,
  IDownloadEntitlementRequest,
} from "./IDownloadService";
import { IDownloadTarget } from "~/src/modules/download/models/IDownloadTarget";

// /download/* routes live on the main app (same serverUrl as the other
// serviceEndpoints). Mirrors PaywallService's construction.
const DOWNLOAD_BASE = "download";

export default class DownloadService
  extends ApiService
  implements IDownloadService {
  constructor() {
    super(environment.serviceEndpoints.membership);
  }

  public async getTargets(): Promise<IDownloadTarget[]> {
    const res = await this.get<any>(`${DOWNLOAD_BASE}/targets`);
    const list = Array.isArray(res) ? res : res?.targets ?? res?.data ?? [];
    return Array.isArray(list) ? (list as IDownloadTarget[]) : [];
  }

  public async mintEntitlement(
    request: IDownloadEntitlementRequest
  ): Promise<IDownloadEntitlement> {
    // Identity comes from the login JWT server-side; one call both gates
    // (403 => not entitled) and returns the token.
    const res = await this.post<Record<string, any>, any>(
      `${DOWNLOAD_BASE}/entitlement`,
      { device_class: request.deviceClass }
    );
    return {
      token: res?.token ?? res?.entitlement_token,
      expiresAt: res?.expires_at ?? res?.expiresAt,
      entitled: Boolean(res?.entitled ?? res?.token),
    };
  }
}
