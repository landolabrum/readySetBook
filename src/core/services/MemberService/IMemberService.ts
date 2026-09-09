import IAuthenticatedUser, { GuestContext, UserAddress } from "~/src/models/ICustomer";
import { EventEmitter } from "@webstack/helpers/EventEmitter";
import { IPaymentMethod } from "~/src/modules/user-profile/model/IMethod";
import { ICustomer } from "~/src/models/CustomerContext";

export type ICustomerUpdateRequest = Partial<ICustomer> & Pick<ICustomer, "id">;
export interface IEncryptJWT {
  tokenData: object,
  secret: string,
  algorithm: 'HS256'
}
export interface IDecryptJWT {
  token: string,
  secret: string,
  algorithm: 'HS256',
  verify?: boolean,
}
export interface IEncryptMetadataJWT {
  encryptionData: object;
  customer_id: string;
  metadata_key_name: string;
}
export interface OEncryptMetadataJWT {
  status: string;
  metadata_key_name: string;
}
export interface SetupIntentSecretRequest {
  id?: string;
  name: string;
  email: string;
  address?: UserAddress;
  phone: string;
}
export interface PaymentIntentSecretRequest {
  id?: string;
  name: string;
  email: string;
  address?: UserAddress;
  phone: string;
}
export interface IUserLocationPayload {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
  deviceId?: string;
  deviceLabel?: string;
  deviceType?: string;
  device_info?: any;
  deviceInfo?: any;
  speedMph?: number;
  isSharedDevice?: boolean;
}
export interface IUserTimelineOptions {
  limit?: number;
  deviceId?: string;
}
export type GuardianFriendDevice = {
  deviceId: string;
  deviceLabel?: string | null;
  deviceType?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt?: string;
};

export type GuardianFriend = {
  friendUserId: string;
  alias?: string | null;
  createdAt?: string;
  updatedAt?: string;
  devices?: GuardianFriendDevice[];
};

export type FriendCounts = {
  followers: number;
  following: number;
};

export type SearchCustomer = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type DmThread = {
  id: number;
  name?: string | null;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: DmMessage;
  participants?: DmParticipant[];
  /** Legacy friend mapping for older 1:1 threads */
  friendUserId?: string;
};

export type DmParticipant = {
  userId: string;
  alias?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  addedAt?: string;
};

export type DmMessage = {
  id: number;
  threadId: number;
  senderId: string;
  recipientId: string;
  body: string;
  sentAt: string;
  readAt?: string | null;
};

// Streaming: per-user provider configs
export interface IUserStreamPayload {
  id?: string; // Stream ID for updates (omit for new streams)
  provider: string;
  eventId: string; // Primary key — streams are tied to events
  userId?: string; // Audit field
  userName?: string; // Audit field
  streamKey?: string;
  serverUrl?: string;
  protocol?: string;
  websiteUrl?: string;
  rtmpUrl?: string;
  enabled?: boolean;
  containerName?: string;
  userHandle?: string;
  video?: Record<string, any>;
  audio?: Record<string, any>;
  network?: Record<string, any>;
  selectedDeviceId?: string; // Pi5 device ID for stream delegation
}

export interface IStreamRuntimeHints {
  gpuRequired?: boolean;
  gpuRequested?: boolean;
  gpuAvailable?: boolean;
  gpuMessage?: string;
  headlessFallbackAllowed?: boolean;
  headlessFallbackUsed?: boolean;
  display?: string;
}

export interface IUserStream {
  id?: string;
  eventId: string; // Primary key — streams are tied to events
  userId?: string;
  userName?: string | null;
  provider: string;
  streamKey?: string | null;
  serverUrl?: string | null;
  protocol?: string | null;
  websiteUrl?: string | null;
  rtmpUrl?: string | null;
  containerName?: string | null;
  userHandle?: string | null;
  hlsUrl?: string | null;
  hlsResolvedAt?: string | null;
  enabled?: boolean;
  destination?: string | null;
  ingestUrl?: string | null;
  sessionId?: string | null;
  status?: string | null;
  message?: string | null;
  previewUrl?: string | null;
  logs?: any[];
  outputs?: any[];
  video?: Record<string, any>;
  audio?: Record<string, any>;
  network?: Record<string, any>;
  logTail?: any[];
  lastHeartbeat?: string | null;
  runtimeHints?: IStreamRuntimeHints;
  runtimeError?: string | null;
  selectedDeviceId?: string | null; // Pi5 device ID for delegation
  containerHost?: string | null; // Physical host that runs container
  containerNetwork?: string | null; // Device-specific network name
  deviceStatus?: string | null; // "online", "offline", "error"
  deviceError?: string | null; // Last device error message
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface IUserStreamResponse {
  stream?: IUserStream;
  streams?: IUserStream[];
  deleted?: boolean;
  provider?: string;
}

export interface IResolveHlsResponse {
  hlsUrl: string;
  hlsResolvedAt: string | null;
  provider: string;
  live?: boolean;
}

export type ISessionCartItem = any;
export interface ISessionData {
  cart_items: ISessionCartItem[],
  customer_id?: string,
  method_id?: string
}
export interface IResetPassword {
  email: string, user_agent: object
};
export interface OResetPassword {
  status: string;
}
export interface IChangePasswordRequest {
  customer_id: string;
  current_password: string;
  new_password: string;
}
export interface OChangePasswordResponse {
  status: string;
  detail: string;
}
export default interface IMemberService {
  // IMemberService
  processTransaction(sessionData: ISessionData): Promise<any>;
  resetPassword({ email, user_agent }: IResetPassword): Promise<OResetPassword>;
  getCurrentUser(): IAuthenticatedUser | undefined;
  getCurrentGuest(): IAuthenticatedUser | undefined;
  getSetupIntent(client_secret: string): any;
  updateCurrentUser(user: IAuthenticatedUser): void;

  getMethods(customerId?: string): Promise<any>;
  getPaymentIntents(customerId?: string): Promise<any>;
  deleteMethod(id: string): Promise<any>;
  createSetupIntent(customer_id: string, method?: IPaymentMethod): any;

  userChanged: EventEmitter<IAuthenticatedUser | undefined>;
  guestChanged: EventEmitter<GuestContext | undefined>;

  verifyEmail(token: string): Promise<any>;
  verifyPassword(token: string): Promise<any>;
  logInUser(cust: any): Promise<any | any>;
  signUp({
    name,
    email,
    password,
    merchant,
    user_agent,
    metadata
  }: any): Promise<any>;
  logOutUser(): Promise<string>;
  getCurrentUserToken(): string | undefined;
  getPersonalInformation(): Promise<any | null>;
  getMemberProfileInformation(memberId: string): Promise<any | null>;
  modifyCustomer(customer: ICustomerUpdateRequest): Promise<any>;
  changePassword(payload: IChangePasswordRequest): Promise<OChangePasswordResponse>;
  toggleCustomerDefaultMethod(paymentMethodId: string): Promise<any>;

  encryptMetadataJWT({ encryptionData, customer_id, metadata_key_name }: IEncryptMetadataJWT): Promise<OEncryptMetadataJWT>;
  decryptMetadataJWT(metadata_key_name: string, customer_id: string): Promise<object>;

  encryptJWT({ tokenData, secret, algorithm }: IEncryptJWT): Promise<any>;
  decryptJWT({ token, secret, algorithm }: IDecryptJWT): Promise<any>;
  updateUserLocation(payload: IUserLocationPayload): Promise<any>;
  getUserLocation(userId?: string, deviceId?: string): Promise<any>;
  removeUserDevice(userId?: string, deviceId?: string, options?: { purgeTimeline?: boolean }): Promise<any>;
  adminRemoveUserDevice(userId: string, deviceId: string, options?: { purgeTimeline?: boolean }): Promise<any>;
  getAdminUserLocations(): Promise<any>;
  getFleetLocations(): Promise<any>;
  adminPurgeGpsTracking(): Promise<any>;
  getUserTimeline(userId?: string, options?: IUserTimelineOptions): Promise<any>;
  listGuardianFriends(): Promise<{ data: GuardianFriend[]; count?: number; followers?: number; following?: number }>;
  searchCustomers(term: string): Promise<{ data: SearchCustomer[] }>;
  addGuardianFriend(friendUserId: string, alias?: string): Promise<any>;
  removeGuardianFriend(friendUserId: string): Promise<any>;

  /** Direct messages */
  listDmThreads(): Promise<{ data: DmThread[] }>;
  listDmMessages(threadId: number | string, cursor?: number, limit?: number): Promise<{ data: DmMessage[]; nextCursor?: number | null }>;
  sendDm(threadId: number | string, body: string): Promise<{ data: DmMessage }>;
  markDmRead(threadId: number | string, cursor?: number): Promise<{ updated: number }>;
  deleteDmMessage(messageId: number): Promise<{ status: string; id: number }>;
  createDmThread(participantIds: string[], name?: string | null): Promise<{ data: DmThread }>;
  listDmParticipants(threadId: number): Promise<{ data: DmParticipant[] }>;
  addDmParticipants(threadId: number, userIds: string[]): Promise<{ data: DmParticipant[] }>;
  removeDmParticipant(threadId: number, userId: string): Promise<{ data: DmParticipant[] }>;

  /** User stream settings */
  listUserStreams(eventId: string, userId?: string): Promise<IUserStreamResponse>;
  upsertUserStream(payload: IUserStreamPayload): Promise<IUserStreamResponse>;
  /** Delete stream by ID or provider (legacy). Supports multi-stream per provider. */
  deleteUserStream(streamIdOrProvider: string, eventId: string, userId?: string): Promise<IUserStreamResponse>;
  resolveHls(provider: string, eventId: string, userId?: string, streamId?: string): Promise<IResolveHlsResponse>;

  /** Site settings (Canopy layout, last event, preferences) */
  getSiteSettings(customerId: string): Promise<any>;
  saveSiteSettings(customerId: string, settings: any): Promise<any>;

  /** Dynamic clearance-gated routes from backend */
  getMemberRoutes(): IDynamicRoute[];
  saveMemberRoutes(routes: IDynamicRoute[] | null | undefined): void;
}

export interface IDynamicRoute {
  id?: number;
  parent_id?: number | null;
  sort_order?: number;
  href?: string | null;
  modal?: string | null;
  label?: string | null;
  altLabel?: string | null;
  icon?: string | null;
  clearance?: number;
  mid?: string | string[] | null;
  hide?: boolean;
  badge?: string | null;
  items?: IDynamicRoute[];
  children?: IDynamicRoute[];
}
