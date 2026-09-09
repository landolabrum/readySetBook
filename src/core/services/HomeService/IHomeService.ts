export interface ILight {
  id_: string;
  name: string;
  is_on: boolean;
  bri: number;
  hue: number;
  sat: number;
  hex: string;
  sdk: {
    bridge_ip: string;
    username: string;
  };
}

export interface IGroup {
  group_id: string;
  group_name: string;
  lights: ILight[]; // Now lights are an array of ILight objects
  // Add other properties as needed based on the attributes of a group
}

export interface IHomePostLight {
  id: string;
  name: string;
  // Add other properties as needed based on the attributes of a light
}

export interface IHomePostLightRename extends IHomePostLight {
  new_name: string;
}

interface IHomePostGroup {
  group_name: string;
  lights: string[]; // Assuming light IDs are strings
}

interface IHomePutGroupModify {
  group_id: string;
  group_name?: string;
  lights?: string[];
}export type GpsSource = "ic2" | "tcp" | "udp";

export interface IGpsFix {
  lat: number;
  lon: number;
  timestamp: string;      // ISO8601 Z
  speed_mps?: number;
  alt_m?: number;
}

export interface IGpsStatus {
  udp_ports: number[];
  tcp_ports: number[];
  udp_latest: Record<string, IGpsFix>;
  tcp_latest: Record<string, IGpsFix>;
  ic2_cached_devices: number[];
  fresh_secs: number;
}

export interface IIc2Credential {
  id: number;
  name?: string | null;
  org_id: string;
  group_id: string;
  client_id: string;
}

export interface IIc2Device {
  id: number;
  name?: string | null;
  sn?: string | null;
  online?: boolean | null;
}


export interface IHomeService {

  // /gps/live is UDP/TCP only. IC2 bindings go through gpsCreateBinding.
  gpsLive(params?: {
    source?: "tcp" | "udp";
    port?: number;
    event_id?: number;
    team_id?: number;
    label?: string;
    save?: boolean;
  }): Promise<IGpsFix>;
  gpsLiveForTeam(eventId: number, teamId: number, cfg: {
    source: 'udp' | 'tcp';
    port?: number;
    label?: string;
    save?: boolean;
  }): Promise<any>

  // IC2 credential management (per-user, reusable across events/teams)
  ic2ListCredentials(): Promise<IIc2Credential[]>;
  ic2CreateCredential(body: {
    name?: string;
    org_id: string;
    group_id: string;
    client_id: string;
    client_secret: string;
  }): Promise<IIc2Credential>;
  ic2DeleteCredential(id: number): Promise<{ status: string }>;
  ic2ListDevices(credentialId: number): Promise<IIc2Device[]>;

  // Bind a team to an IC2 device using a stored credential (no creds in payload).
  gpsCreateBinding(body: {
    event_id: number;
    team_id: number;
    ic2_credential_id: number;
    device_id: number;
    label?: string;
  }): Promise<{ status: string; fix?: IGpsFix | null; credential_id: number }>;

  gpsStatus(): Promise<IGpsStatus>;


  createGroup(newGroup: IGroup): Promise<IGroup>;
  modifyGroup(modifiedGroup: IHomePutGroupModify): Promise<IGroup>;
  deleteGroup(group_id: string): Promise<any>;
  listGroups(): Promise<IGroup[]>; // If you want to list all groups
  hue_list(hue_object?: string): Promise<ILight[]>;
  light({ id, name }: IHomePostLight): Promise<ILight>;
  hue_brightness(id: number, brightness: number, type?: string): Promise<ILight>;
  lightColor(id: any, hex: string, type?: string): Promise<any>;
  lightsOff(): Promise<any>;
  hue_toggle(id: any, hue_object?: string): Promise<any>;
  lightsOn(): Promise<any>;
  hue_rename(lightRename: IHomePostLightRename): Promise<any>;

  startVehicle(request: any): Promise<any>;
  getVehicles(access: any): Promise<any>;

  // Spotify control methods
  spotifyPlay(): Promise<any>;
  spotifyPause(): Promise<any>;
  spotifyNextTrack(): Promise<any>;
  spotifyPreviousTrack(): Promise<any>;
  setSpotifyVolume(volumePercent: number): Promise<any>;
  spotifyAuthorize(): Promise<any>;
  spotifyCallback(): Promise<any>;
  getSpotifyToken(): Promise<{ access_token: string }>;
}
export default IHomeService;
