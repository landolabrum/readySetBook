import ApiService from "../ApiService";
import environment from "~/src/core/environment";
import IHomeService, {
  IGpsFix,
  IGpsStatus,
  IGroup,
  IHomePostLight,
  IHomePostLightRename,
  IIc2Credential,
  IIc2Device,
  ILight,
} from "./IHomeService";
import { getService } from "@webstack/common";
import IMemberService from "../MemberService/IMemberService";

export default class HomeService extends ApiService implements IHomeService {
  private MemberService: IMemberService;

  constructor() {
    super(environment.serviceEndpoints.home);
    this.MemberService = getService<IMemberService>("IMemberService");
  }

  /** UDP/TCP one-shot fix. IC2 bindings go through gpsCreateBinding. */
  public async gpsLive(params?: {
    source?: "tcp" | "udp";
    port?: number;
    event_id?: number;
    team_id?: number;
    label?: string;
    save?: boolean;
  }): Promise<IGpsFix> {
    const qs = new URLSearchParams();
    if (params?.source) qs.set("source", params.source);
    if (typeof params?.port === "number") qs.set("port", String(params.port));
    if (typeof params?.event_id === "number") qs.set("event_id", String(params.event_id));
    if (typeof params?.team_id === "number") qs.set("team_id", String(params.team_id));
    if (typeof params?.label === "string" && params.label.trim()) qs.set("label", params.label.trim());
    if (params?.save === false) qs.set("save", "0");

    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.get<IGpsFix>(`/gps/live${suffix}`);
  }


  /** Pair a team to a UDP/TCP feed in one call. */
  public async gpsLiveForTeam(
    event_id: number,
    team_id: number,
    opts?: {
      source?: "tcp" | "udp";
      port?: number;
      label?: string;
      save?: boolean; // default true
    }
  ): Promise<IGpsFix> {
    return this.gpsLive({ event_id, team_id, save: true, ...opts });
  }

  public async gpsStatus(): Promise<IGpsStatus> {
    return this.get<IGpsStatus>(`/gps/status`);
  }

  // =========================
  // IC2 credentials (per-user)
  // =========================
  public async ic2ListCredentials(): Promise<IIc2Credential[]> {
    const res = await this.get<{ data: IIc2Credential[] }>(`/gps/ic2/credentials`);
    return Array.isArray(res?.data) ? res.data : [];
  }

  public async ic2CreateCredential(body: {
    name?: string;
    org_id: string;
    group_id: string;
    client_id: string;
    client_secret: string;
  }): Promise<IIc2Credential> {
    const res = await this.post<typeof body, { data: IIc2Credential }>(`/gps/ic2/credentials`, body);
    return res?.data as IIc2Credential;
  }

  public async ic2DeleteCredential(id: number): Promise<{ status: string }> {
    return this.delete<{ status: string }>(`/gps/ic2/credentials/${id}`);
  }

  public async ic2ListDevices(credentialId: number): Promise<IIc2Device[]> {
    const res = await this.get<{ data: IIc2Device[] }>(`/gps/ic2/credentials/${credentialId}/devices`);
    return Array.isArray(res?.data) ? res.data : [];
  }

  public async gpsCreateBinding(body: {
    event_id: number;
    team_id: number;
    ic2_credential_id: number;
    device_id: number;
    label?: string;
  }): Promise<{ status: string; fix?: IGpsFix | null; credential_id: number }> {
    return this.post<typeof body, { status: string; fix?: IGpsFix | null; credential_id: number }>(
      `/gps/binding`,
      body
    );
  }

  // Camera/stream/PTZ endpoints moved to SurveillanceService (ISurveillanceService).

  public async light({ id, name }: IHomePostLight): Promise<ILight> {
    return this.post<IHomePostLight, ILight>("/hue/light", { id, name });
  }

  public async hue_list(type = "light"): Promise<any> {
    return await this.get<any>(`/home/hue/list?type=${type}`);
  }

  public async lightsOn(): Promise<any> {
    return await this.get<any>("/home/hue/all-on");
  }

  public async lightsOff(): Promise<any> {
    return await this.get<any>("/home/hue/all-off");
  }

  public async hue_brightness(id: number, brightness: number, type?: string): Promise<any> {
    return this.post<any, any>(`/home/hue/light-bri?id=${id}&bri=${brightness}&type=${type}`);
  }

  public async listGroups(): Promise<any> {
    return await this.get<any>("/home/hue/groups");
  }

  public async hue_rename({ id, name, new_name }: IHomePostLightRename): Promise<any> {
    const requestData = { id, name, new_name };
    return await this.post<any, any>("/home/hue/light/rename", requestData);
  }

  public async createGroup(newGroup: IGroup): Promise<IGroup> {
    return await this.post<IGroup, IGroup>("/home/hue/groups", newGroup);
  }

  public async modifyGroup(request: any): Promise<any> {
    const { group_id, ...data } = request;
    return await this.put<any, any>(`/home/hue/groups/${group_id}`, data);
  }

  public async deleteGroup(group_id: string): Promise<any> {
    return await this.delete<any>(`/home/hue/groups/${group_id}`);
  }

  public async hue_toggle(id: any, hue_object: string = "light"): Promise<any> {
    return this.get<any>(`/home/hue/toggle?id=${id}${(hue_object && `&type=${hue_object}`) || ""}`);
  }

  public async lightColor(id: any, hex: string, type: string): Promise<any> {
    return this.get<any>(`/home/hue/light-hex-color?id=${id}&hex=${hex.replaceAll("#", "")}&type=${type}`);
  }

  public async getVehicles(access: any): Promise<any> {
    return this.post<any, any>("/auto/vehicles", access);
  }

  public async startVehicle(request: any): Promise<any> {
    return this.post<any, any>("/auto/vehicle/start", request);
  }

  // Spotify
  public async spotifyPlay(): Promise<any> {
    return await this.put<any, any>("/stream/spotify/play", {});
  }

  public async spotifyPause(): Promise<any> {
    return await this.put<any, any>("/stream/spotify/pause", {});
  }

  public async spotifyNextTrack(): Promise<any> {
    return await this.post<any, any>("/stream/spotify/next", {});
  }

  public async spotifyPreviousTrack(): Promise<any> {
    return await this.post<any, any>("/stream/spotify/previous", {});
  }

  public async setSpotifyVolume(volumePercent: number): Promise<any> {
    return await this.put<any, any>(`/stream/spotify/volume?volumePercent=${volumePercent}`, {});
  }

  public async spotifyAuthorize(): Promise<any> {
    return this.get<any>(`/stream/spotify/authorize`);
  }

  public async spotifyCallback(): Promise<any> {
    return this.get<any>(`/stream/spotify/callback`);
  }

  public async getSpotifyToken(): Promise<{ access_token: string }> {
    return await this.get<{ access_token: string }>(`/stream/spotify/token`);
  }

  protected appendHeaders(headers: { [key: string]: string }) {
    super.appendHeaders(headers);
    const token = this.MemberService.getCurrentUserToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
}
