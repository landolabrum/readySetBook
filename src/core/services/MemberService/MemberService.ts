
import CookieHelper from "@webstack/helpers/CookieHelper";
import { EventEmitter } from "@webstack/helpers/EventEmitter";
import environment from "~/src/core/environment";
import CustomToken from "~/src/models/CustomToken";
import MemberToken from "~/src/models/MemberToken";
import IAuthenticatedUser, { GuestContext } from "~/src/models/ICustomer";

import ApiService, { ApiError, FormFieldsException } from "../ApiService";
import IMemberService, { IChangePasswordRequest, ICustomerUpdateRequest, IDecryptJWT, IDynamicRoute, IEncryptJWT, IEncryptMetadataJWT, IResetPassword, ISessionData, IUserLocationPayload, IUserTimelineOptions, IUserStream, IUserStreamPayload, IUserStreamResponse, IResolveHlsResponse, OChangePasswordResponse, OResetPassword } from "./IMemberService";
import { IPaymentMethod } from "~/src/modules/user-profile/model/IMethod";
import { encryptString } from "@webstack/helpers/Encryption";
import errorResponse from "../../errors/errorResponse";
const MEMBER_TOKEN_NAME = environment.legacyJwtCookie.authToken;
const MEMBER_ROUTES_NAME = environment.legacyJwtCookie.authRoutes;
const TRANSACTION_TOKEN_NAME = environment.legacyJwtCookie.transactionToken;
const GUEST_TOKEN_NAME = environment.legacyJwtCookie.guestToken;
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION?.trim();

const TIMEOUT = 5000;
function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((resolve, reject) => {
    timeoutHandle = setTimeout(() => reject(new ApiError(
      "Server Down",
      409,
      "MS.SI.02",
      "Server is unreachable"
    )
    ), ms);
  });

  return Promise.race([
    promise,
    timeoutPromise
  ]).then((result) => {
    clearTimeout(timeoutHandle);
    return result;
  }) as Promise<T>;
}


export default class MemberService
  extends ApiService
  implements IMemberService {
  constructor() {
    super(environment.serviceEndpoints.membership);
  }
  private _userContext: IAuthenticatedUser | undefined;
  private _guestContext: IAuthenticatedUser | undefined;
  private _guestToken: string | undefined;
  private _userToken: string | undefined;
  private _timeout: number | undefined;
  private userLocationPollPromise: Promise<any> | null = null;
  private lastUserLocationCompletedAt = 0;
  private static readonly USER_LOCATION_POLL_INTERVAL_MS = 3000;
  public userChanged = new EventEmitter<IAuthenticatedUser | undefined>();
  public guestChanged = new EventEmitter<GuestContext | undefined>();
  async logOutUser(): Promise<string> {
    if (!this.getCurrentUserToken) return "No User";
    this.updateUserContext(undefined, undefined);
    this.deleteMemberToken();
    this.deleteMemberRoutes();
    this.deleteLegacyCookie();
    return "Success";
  }
  async logOutGuest(): Promise<string> {
    if (!this.getCurrentGuestToken) return "No User";
    this.updateguestContext(undefined, undefined);
    this.deleteguestToken();
    this.deleteLegacyguestCookie();
    return "Success";
  }
  private deleteLegacyCookie() {
    const props: { [key: string]: string } = {};
    const jwtCookie = environment.legacyJwtCookie;
    props.path = "/";
    if (jwtCookie.domain) props.domain = jwtCookie.domain;
    CookieHelper.deleteCookie(jwtCookie.authToken)
  }
  private deleteLegacyguestCookie() {
    const props: { [key: string]: string } = {};
    const jwtCookie = environment.legacyJwtCookie;
    props.path = "/";
    if (jwtCookie.domain) props.domain = jwtCookie.domain;
    CookieHelper.setCookie(jwtCookie.guestToken, "", props);
  }
  public async verifyEmail(token: string): Promise<any> {
    if (!token) {
      throw new ApiError("No Token Provided", 400, "MS.SI.02");
    }

    try {
      const encodedToken = encodeURIComponent(token);
      // Wrap the API call with the timeout promise
      const verifiedMemberResp = await timeoutPromise(
        this.get<any>(`/usage/auth/verify-email?token=${encodedToken}`),
        TIMEOUT // 5 seconds timeout
      );
      if (verifiedMemberResp instanceof ApiError) {
        throw verifiedMemberResp;
      }
      return verifiedMemberResp;

    } catch (error) {
      console.error("[ verifiedMemberResp ]:", error)

      return error
    }
  }
  public async logInUser(cust: any): Promise<any | any> {
    if (!cust.email) {
      throw new ApiError("Email is required", 400, "MS.SI.01");
    }
    if (!cust.metadata.user.password) {
      throw new FormFieldsException([{ name: "password", "error": "Password is required" }], 400, "MS.SI.02");
    }

    // Encrypt the login data
    const encryptedLoginData = encryptString(JSON.stringify(cust), ENCRYPTION_KEY);
    const memberJwt: any = await this.post<{}, any>(
      "usage/auth/login",
      { data: encryptedLoginData },
    );

    if (memberJwt?.detail?.fields) {
      throw memberJwt;
    }

    // Token save is the critical operation — must succeed
    this.saveMemberToken(memberJwt);

    // Persist clearance-gated routes returned in the JWT claims (additive field).
    try {
      const parsed = this.parseToken(memberJwt) as any;
      this.saveMemberRoutes(parsed?.routes ?? []);
    } catch (e) {
      console.warn("[MemberService.logInUser] Routes extract failed:", e);
    }

    // Best-effort: legacy cookie (non-critical)
    try { this.saveLegacyAuthCookie(memberJwt); } catch (e) {
      console.warn("[MemberService.logInUser] Legacy cookie save failed:", e);
    }

    // Refresh user context from stored token
    try {
      return this._getCurrentUser(true)!;
    } catch (e) {
      console.warn("[MemberService.logInUser] User context refresh failed:", e);
      // Token is saved; parse a minimal user from the JWT so onSuccess still fires
      const parsed = this.parseToken(memberJwt);
      return parsed?.user;
    }

  };


  public async verifyPassword(token: string): Promise<any> {
    if (!token) {
      throw new ApiError("No Token Provided", 400, "MS.SI.02");
    }

    try {
      const verifiedMemberResp = await timeoutPromise(
        this.get<any>(`/usage/auth/verify-password?token=${token}`),
        TIMEOUT // 5 seconds timeout
      );

      // Check if the response is an ApiError
      if (verifiedMemberResp instanceof ApiError) {
        throw verifiedMemberResp;
      }

      const customer_token = verifiedMemberResp?.customer_token;
      if (customer_token) {
        this.saveMemberToken(customer_token);
        this.saveLegacyAuthCookie(customer_token);
        this._getCurrentUser(true)!;
      }

      // If everything is successful, return the response
      return verifiedMemberResp;
    } catch (error) {
      // Handle the error here
      if (error instanceof ApiError) {
        return errorResponse(error);
      } else {
        // Handle other types of errors as needed
        console.error("An unexpected error occurred:", error);
        const responseError = new ApiError("Internal Server Error", 500, "MS.SI.01", "an Unknown Error Occured");
        return errorResponse(responseError);
      }
    }
  }

  public async toggleCustomerDefaultMethod(paymentMethodId: string): Promise<any> {
    let customerId = this._getCurrentUser(false)?.id;
    if (!paymentMethodId || !customerId) {
      throw new ApiError("Payment method ID or customer ID not provided", 400, "MS.TDPM.01");
    }

    try {
      // Assuming the second type argument is for the request body type
      const response: any = await this.post<any, { paymentMethodId: string; customerId: string }>(
        `method/toggle-default?mid=${paymentMethodId}&cid=${customerId}`,
        { paymentMethodId, customerId }
      );
      if (response?.data) {
        this.updateUserContext(response.data, undefined);
      }
      return response;
    } catch (error: any) {
      throw new ApiError("Error toggling default payment method", 500, "MS.TDPM.02");
    }
  }

  public async createSetupIntent(customer_id: string, method?: IPaymentMethod): Promise<any> {
    if (customer_id) {

      const res = await this.get<any>(
        `setup-intent/create?customer_id=${customer_id}`
      )
      return res
    } else {
      throw new ApiError("No ID Provided", 400, "MS.SI.02");
    }
    // const memberMethod = async () => {
    //   try {

    //     const response: any = await this.post<any, {}>(
    //       `api/setup-intent/create`,
    //       {customer_id}
    //     );
    //     return response;
    //   } catch (e: any) {
    //     return e;
    //   }
    // }
    // if (customer_id && !method) {
    //   return await memberMethod();
    // }
    // else if (!customer_id && method) {
    //   throw new ApiError("UNHANDLED (!customer_id)", 400, "MS.SI.02");
    // }
    // if (!method) {
    //   throw new ApiError("NO MEMBER DATA PROVIDED", 400, "MS.SI.02");
    // }
  }
  public async getSetupIntent(client_secret: string) {
    if (client_secret) {

      const res = await this.get<any>(
        `usage/customer/method/confirm?setup_intent_client_secret=${client_secret}`
      )
      return res
    } else {
      throw new ApiError("No ID Provided", 400, "MS.SI.02");
    }
  }
  public async processTransaction(sessionData: ISessionData) {
    const { cart_items, customer_id, method_id } = sessionData;

    if (!cart_items || !customer_id || !method_id) {
      const missingFields = [];
      if (!cart_items) missingFields.push("cart_items");
      if (!customer_id) missingFields.push("customer_id");
      if (!method_id) missingFields.push("method_id");

      throw new ApiError(`Missing required field(s): ${missingFields.join(', ')}`, 400, "MS.SI.01");
    }

    let session = {
      cart_items,
      customer_id: customer_id || this._getCurrentUser(false)?.id,
      method_id
    };


    const res = await this.post<{}, any>(
      "usage/checkout/process",
      session
    )
    this.saveTransactionToken(res);
    this.saveLegacyTransactionCookie(res);

    return res
  }


  public async encryptMetadataJWT(props: IEncryptMetadataJWT) {
    const { encryptionData, customer_id: customer_id, metadata_key_name } = props;
    if (!encryptionData || !customer_id || !metadata_key_name) {
      console.error('[ ERROR ]', {
        location: "MemberService.encryptMetadataJWT",
        ...props
      })
      throw new ApiError("No Encryption Data Provided", 400, "MS.SI.02");
    }
    const res = await this.post<{}, any>(
      "customer/encrypt-metadata", { encryptionData: encryptionData, customer_id, metadata_key_name }
    )
    return res
  }
  public async decryptMetadataJWT(metadata_key_name: string, customer_id: string) {
    if (!metadata_key_name || !customer_id) throw new ApiError("No [ metadata_key_name ] Provided", 400, "MS.SI.02");
    const res = await this.get<any>(
      `customer/encrypt-metadata?key=${metadata_key_name}&customer_id=${customer_id}`,
    )
    return res
  }

  public async encryptJWT({ tokenData, secret, algorithm }: IEncryptJWT) {
    if (!tokenData || !secret || !algorithm) throw new ApiError("No Encryption Data Provided", 400, "MS.SI.02");
    const res = await this.post<{}, any>(
      "encrypt-jwt", { tokenData, secret, algorithm }
    )
    return res
  }
  public async decryptJWT({ token, secret, algorithm, verify }: IDecryptJWT) {
    if (!token || !secret || !algorithm) throw new ApiError("No Encryption Data Provided", 400, "MS.SI.02");
    const res = await this.post<{}, any>(
      "decrypt-jwt", { token, secret, algorithm, verify }
    )
    return res
  }

  public async updateUserLocation(payload: IUserLocationPayload) {
    const {
      userId,
      latitude,
      longitude,
      accuracy,
      timestamp,
      device_info,
      deviceInfo,
      deviceId,
      deviceLabel,
      deviceType,
      speedMph,
      isSharedDevice,
    } = payload || {};
    if (!userId || latitude === undefined || longitude === undefined) {
      throw new ApiError("userId, latitude, and longitude are required", 400, "MS.LOC.01");
    }
    const body = {
      userId,
      latitude,
      longitude,
      accuracy,
      timestamp: timestamp || new Date().toISOString(),
      device_info: { source: "guardian", ...(device_info ?? deviceInfo ?? {}) },
      deviceId,
      deviceLabel,
      deviceType,
      speedMph,
      isSharedDevice,
    };
    return this.post<typeof body, any>("gps/user/location", body);
  }

  public async getUserLocation(userId?: string, deviceId?: string) {
    if (this.userLocationPollPromise) return this.userLocationPollPromise;

    const waitMs = Math.max(
      0,
      MemberService.USER_LOCATION_POLL_INTERVAL_MS -
      (Date.now() - this.lastUserLocationCompletedAt)
    );

    if (waitMs > 0) {
      this.userLocationPollPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          this.startUserLocationRequest(userId, deviceId)
            .then(resolve)
            .catch(reject);
        }, waitMs);
      });
      return this.userLocationPollPromise;
    }

    return this.startUserLocationRequest(userId, deviceId);
  }

  public async removeUserDevice(userId?: string, deviceId?: string, options?: { purgeTimeline?: boolean }) {
    if (!deviceId) {
      throw new ApiError("deviceId is required", 400, "MS.LOC.02");
    }
    const qs = new URLSearchParams();
    if (userId) qs.set("userId", userId);
    qs.set("deviceId", deviceId);
    if (options?.purgeTimeline !== undefined) {
      qs.set("purgeTimeline", String(Boolean(options.purgeTimeline)));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.delete<any>(`gps/user/location${suffix}`);
  }

  public async adminRemoveUserDevice(userId: string, deviceId: string, options?: { purgeTimeline?: boolean }) {
    if (!userId) {
      throw new ApiError("userId is required", 400, "MS.LOC.03");
    }
    if (!deviceId) {
      throw new ApiError("deviceId is required", 400, "MS.LOC.02");
    }
    const urlToken =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
    const rawToken = this.getCurrentUserToken() || this.getAuthToken() || urlToken;
    const token = rawToken?.startsWith("Bearer ") ? rawToken.slice("Bearer ".length) : rawToken;
    const qs = new URLSearchParams();
    qs.set("userId", userId);
    qs.set("deviceId", deviceId);
    if (options?.purgeTimeline !== undefined) {
      qs.set("purgeTimeline", String(Boolean(options.purgeTimeline)));
    }
    if (token) qs.set("token", token);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.delete<any>(`gps/admin/device${suffix}`);
  }

  public async getAdminUserLocations(page?: number, pageSize?: number) {
    const urlToken =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
    const rawToken = this.getCurrentUserToken() || this.getAuthToken() || urlToken;
    const token = rawToken?.startsWith("Bearer ") ? rawToken.slice("Bearer ".length) : rawToken;
    const qs = new URLSearchParams();
    if (page) qs.set("page", String(page));
    if (pageSize) qs.set("page_size", String(pageSize));
    if (token) qs.set("token", token);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.get<any>(`gps/admin/locations${suffix}`);
  }

  public async getFleetLocations() {
    const urlToken =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
    const rawToken = this.getCurrentUserToken() || this.getAuthToken() || urlToken;
    const token = rawToken?.startsWith("Bearer ") ? rawToken.slice("Bearer ".length) : rawToken;
    const qs = new URLSearchParams();
    if (token) qs.set("token", token);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.get<any>(`gps/fleet/locations${suffix}`);
  }

  public async adminPurgeGpsTracking() {
    const urlToken =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
    const rawToken = this.getCurrentUserToken() || this.getAuthToken() || urlToken;
    const token = rawToken?.startsWith("Bearer ") ? rawToken.slice("Bearer ".length) : rawToken;
    const qs = new URLSearchParams();
    qs.set("confirm", "true");
    if (token) qs.set("token", token);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.delete<any>(`gps/admin/purge${suffix}`);
  }

  private startUserLocationRequest(userId?: string, deviceId?: string) {
    const qs = new URLSearchParams();
    if (userId) qs.set("userId", userId);
    if (deviceId) qs.set("deviceId", deviceId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const request = this.get<any>(`gps/user/location${suffix}`);

    this.userLocationPollPromise = request
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        this.lastUserLocationCompletedAt = Date.now();
        this.userLocationPollPromise = null;
      });

    return this.userLocationPollPromise;
  }

  public async getUserTimeline(userId?: string, options?: IUserTimelineOptions) {
    const qs = new URLSearchParams();
    if (userId) qs.set("userId", userId);
    if (options?.limit) {
      const bounded = Math.min(options.limit, 1000); // backend cap
      qs.set("limit", String(bounded));
    }
    if (!options?.limit) {
      qs.set("limit", "1000");
    }
    if (options?.deviceId) qs.set("deviceId", options.deviceId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.get<any>(`gps/user/timeline${suffix}`);
  }

  public async listGuardianFriends() {
    return this.get<any>("gps/user/friends");
  }

  public async searchCustomers(term: string) {
    const qs = new URLSearchParams();
    if (term) qs.set("query", term);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.get<any>(`gps/user/friends/search${suffix}`);
  }

  public async addGuardianFriend(friendUserId: string, alias?: string) {
    const body = { friendUserId, alias };
    return this.post<typeof body, any>("gps/user/friends", body);
  }

  public async removeGuardianFriend(friendUserId: string) {
    const encoded = encodeURIComponent(friendUserId);
    return this.delete<any>(`gps/user/friends/${encoded}`);
  }

  // ----- Direct Messages (Guardian) -----
  public async listDmThreads() {
    return this.get<any>("gps/user/dm/threads");
  }

  public async createDmThread(participantIds: string[], name?: string | null) {
    return this.post<any, any>("gps/user/dm/threads", { participantIds, name });
  }

  public async listDmParticipants(threadId: number | string) {
    const encoded = encodeURIComponent(String(threadId));
    return this.get<any>(`gps/user/dm/threads/${encoded}/participants`);
  }

  public async addDmParticipants(threadId: number | string, userIds: string[]) {
    const encoded = encodeURIComponent(String(threadId));
    return this.post<any, any>(`gps/user/dm/threads/${encoded}/participants`, { userIds });
  }

  public async removeDmParticipant(threadId: number | string, userId: string) {
    const encodedThread = encodeURIComponent(String(threadId));
    const encodedUser = encodeURIComponent(userId);
    return this.delete<any>(`gps/user/dm/threads/${encodedThread}/participants/${encodedUser}`);
  }

  public async listDmMessages(threadId: number | string, cursor?: number, limit?: number) {
    const qs = new URLSearchParams();
    if (cursor) qs.set("cursor", String(cursor));
    if (limit) qs.set("limit", String(limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const encoded = encodeURIComponent(String(threadId));
    return this.get<any>(`gps/user/dm/threads/${encoded}/messages${suffix}`);
  }

  public async sendDm(threadId: number | string, body: string) {
    const encoded = encodeURIComponent(String(threadId));
    return this.post<{ body: string }, any>(`gps/user/dm/threads/${encoded}/messages`, { body });
  }

  public async markDmRead(threadId: number | string, cursor?: number) {
    const encoded = encodeURIComponent(String(threadId));
    return this.post<{ cursor?: number }, any>(`gps/user/dm/threads/${encoded}/read`, cursor ? { cursor } : {});
  }

  public async deleteDmMessage(messageId: number) {
    return this.delete<any>(`gps/user/dm/messages/${messageId}`);
  }

  // ---------- User streams ----------
  public async listUserStreams(eventId: string, userId?: string): Promise<IUserStreamResponse> {
    const qs = new URLSearchParams();
    qs.set("eventId", eventId);
    if (userId) qs.set("userId", userId);
    const suffix = `?${qs.toString()}`;
    return this.get<IUserStreamResponse>(`streaming/user-streams${suffix}`);
  }

  public async upsertUserStream(payload: IUserStreamPayload): Promise<IUserStreamResponse> {
    const qs = new URLSearchParams();
    qs.set("eventId", String(payload.eventId));
    if (payload.userId) qs.set("userId", String(payload.userId));
    const suffix = `?${qs.toString()}`;
    return this.post<IUserStreamPayload, IUserStreamResponse>(`streaming/user-streams${suffix}`, payload);
  }

  public async deleteUserStream(streamIdOrProvider: string, eventId: string, userId?: string): Promise<IUserStreamResponse> {
    const qs = new URLSearchParams();
    qs.set("eventId", eventId);
    if (userId) qs.set("userId", userId);
    const suffix = `?${qs.toString()}`;
    return this.delete<IUserStreamResponse>(`streaming/user-streams/${encodeURIComponent(streamIdOrProvider)}${suffix}`);
  }

  public async resolveHls(provider: string, eventId: string, userId?: string, streamId?: string): Promise<IResolveHlsResponse> {
    const qs = new URLSearchParams();
    qs.set("eventId", eventId);
    if (userId) qs.set("userId", userId);
    if (streamId) qs.set("streamId", streamId);
    const suffix = `?${qs.toString()}`;
    return this.post<{}, IResolveHlsResponse>(`streaming/user-streams/${provider}/resolve-hls${suffix}`, {});
  }

  public updateCurrentUser(user: any): void {
    const newUserData = user.newUserData;
    if (newUserData) {
      // Update your _userContext and _userToken here
      this._userContext = {
        ...this._userContext,
        ...newUserData,
      };

      // Emit the updated user context so any listeners know about the change
      this.userChanged.emit(this._userContext);

    } else {
      console.warn("No new user data provided for update.");
    }
  }

  public async signUp(
    props: any
  ): Promise<IAuthenticatedUser> {
    // console.log("[ SIGNUP ]", props);
    if (!props.email) {
      throw new ApiError("Email is required", 400, "MS.SI.01");
    }
    // console.log("[ SIGNUP PROPS ]", props)
    const encryptedSignUp = encryptString(JSON.stringify(props), ENCRYPTION_KEY);
    const res = await this.post<{}, any>(
      "usage/auth/sign-up",
      { data: encryptedSignUp },
    );
    // GUEST TEMP SIGN IN
    if (res?.status === "guest") {
      const guestJwt = await res.data;
      this.saveguestToken(guestJwt);
      this.saveLegacyguestCookie(guestJwt);
    }
    // console.log("[ SIgn Up Response ]: ", {res})
    return res;

  }
  public async getMethods(customerId?: string): Promise<any> {
    if (customerId) {
      const OGetMethods = await this.get<any>(
        `/method/customer/?id=${customerId}`,
      );
      if (OGetMethods) {
        // this.saveMemberToken(OGetMethods.customer);
        // this.saveLegacyAuthCookie(OGetMethods.customer);
        // this._getCurrentUser(true)!;
      }
      return OGetMethods.methods
    }
    if (!customerId) {
      throw new ApiError("Customer not logged in", 400, "MS.SI.02");
    }
  }

  /**
   * Fetch payment intents for a given customer via MindBurn `payment_intent` router.
   * Returns the raw response from the API (expected shape: { data: [...] }).
   */
  public async getPaymentIntents(customerId?: string): Promise<any> {
    if (!customerId) {
      throw new ApiError("Customer not logged in", 400, "MS.SI.02");
    }

    // Ensure we URL-encode the customer id
    const encoded = encodeURIComponent(customerId);
    const res = await this.get<any>(`/payment-intent/s?customer=${encoded}`);
    return res;
  }
  public async deleteMethod(id: string): Promise<any> {
    if (id) {
      return await this.get<any>(`/method/delete?id=${id}`);
    }
    if (!id) {
      throw new ApiError("NO ID PROVIDED", 400, "MS.SI.02");
    }

  };

  public async modifyCustomer(customer: ICustomerUpdateRequest): Promise<any> {
    if (!customer) {
      throw new ApiError("NO customer PROVIDED", 400, "MS.SI.02");
    }
    if (!customer.id) {
      throw new ApiError("Customer ID is required", 400, "MS.MC.01");
    }

    const encryptedPayload = encryptString(JSON.stringify(customer), ENCRYPTION_KEY);
    if (!encryptedPayload) {
      throw new ApiError("Unable to encrypt customer payload", 500, "MS.MC.03");
    }
    try {
      const res = await this.put<{ data: string }, any>(
        "customer/",
        { data: encryptedPayload },
      );

      // The modify endpoint returns an encrypted customer payload, not an auth JWT.
      // Do not replace the user's auth token to avoid logging them out.
      return res?.data ?? res;
    } catch (error: any) {
      console.error("Error updating member: ", error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(error?.message || "Unable to update member", error?.status || 500, error?.code, error?.detail);
    }
  };

  public async changePassword(payload: IChangePasswordRequest): Promise<OChangePasswordResponse> {
    if (!payload.customer_id) {
      throw new ApiError("Customer ID is required", 400, "MS.CP.01");
    }
    if (!payload.current_password) {
      throw new ApiError("Current password is required", 400, "MS.CP.02");
    }
    if (!payload.new_password || payload.new_password.length < 8) {
      throw new ApiError("New password must be at least 8 characters", 400, "MS.CP.03");
    }

    const encryptedPayload = encryptString(JSON.stringify(payload), ENCRYPTION_KEY);
    if (!encryptedPayload) {
      throw new ApiError("Unable to encrypt password payload", 500, "MS.CP.04");
    }

    try {
      const res = await this.post<{ data: string }, OChangePasswordResponse>(
        "usage/auth/change-password",
        { data: encryptedPayload },
      );
      return res;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        error?.detail || error?.message || "Unable to change password",
        error?.status || 500,
        "MS.CP.05",
      );
    }
  }

  public async getPersonalInformation(): Promise<any | null> {
    return this.get<any | null>(
      "member/profile-info"
    );
  }
  public async getMemberProfileInformation(
    memberId: string
  ): Promise<any | null> {
    return this.post(`/reports/profile-info/${memberId}`);
  }
  private saveLegacyAuthCookie(customJwt: string) {
    if (environment.legacyJwtCookie?.authToken) {
      const jwtCookie = environment.legacyJwtCookie;
      const a = customJwt.split(".");
      if (a.length === 3) {
        const encodedBody = a[1];
        const customToken = JSON.parse(window.atob(encodedBody)) as CustomToken;
        const now = Math.floor(new Date().getTime() / 1000);
        const expires = parseInt(customToken.exp as any);
        const diff = expires - now;
        const props: { [key: string]: string } = {};
        props.path = "/";
        props["max-age"] = diff.toString();
        if (jwtCookie.domain) props.domain = jwtCookie.domain;
        CookieHelper.setCookie(jwtCookie.authToken, customJwt, props);
      }
    }
  }
  private saveLegacyTransactionCookie(transactionToken: string) {
    if (environment.legacyJwtCookie?.transactionToken) {
      const a = transactionToken.split(".");
      if (a.length === 3) {
        const encodedBody = a[1];
        const customToken = JSON.parse(window.atob(encodedBody)) as CustomToken;
        const now = Math.floor(new Date().getTime() / 1000);
        const expires = parseInt(customToken.exp as any);
        const diff = expires - now;
        const props: { [key: string]: string } = {};
        props.path = "/";
        props["max-age"] = diff.toString();
        CookieHelper.setCookie(TRANSACTION_TOKEN_NAME, transactionToken, props);
      }
    }
  }
  private saveLegacyguestCookie(customJwt: string) {
    if (environment.legacyJwtCookie?.guestToken) {
      const jwtCookie = environment.legacyJwtCookie;
      const a = customJwt.split(".");
      if (a.length === 3) {
        const encodedBody = a[1];
        const customToken = JSON.parse(window.atob(encodedBody)) as CustomToken;
        const now = Math.floor(new Date().getTime() / 1000);
        const expires = parseInt(customToken.exp as any);
        const diff = expires - now;
        const props: { [key: string]: string } = {};
        props.path = "/";
        props["max-age"] = diff.toString();
        props['is_guest'] = 'true';
        if (jwtCookie.domain) props.domain = jwtCookie.domain;
        CookieHelper.setCookie(jwtCookie.guestToken, customJwt, props);
      }
    }
  }

  public async resetPassword({ email, user_agent }: IResetPassword): Promise<OResetPassword> {
    const merchant = environment.merchant;
    if (!email) {
      throw new ApiError("Email is required", 400, "MS.SI.01");
    }
    if (!user_agent) {
      throw new ApiError("UA is required", 400, "MS.SI.01");
    }

    // Encrypt the login data

    const encryptedResetPasswordData = encryptString(JSON.stringify({ email, user_agent }), ENCRYPTION_KEY);

    const res = await this.post<{}, any>(
      "usage/auth/reset-password",
      { data: encryptedResetPasswordData },
    );
    const status = await res;

    return status;
  };

  private updateUserContext(
    context: IAuthenticatedUser | undefined,
    token: string | undefined
  ) {
    if (context == null && this._userContext == null) {
      return;
    }
    if (context === this._userContext) {
      return;
    }
    this._userContext = context;
    this._userToken = token;
    this._guestToken = undefined;
    this.userChanged.emit(context);
  }
  private updateguestContext(
    context: GuestContext | undefined,
    token: string | undefined
  ) {
    if (context == null && this._guestContext == null) {
      return;
    }
    if (context === this._guestContext) {
      return;
    }
    this._guestContext = context;
    // HERE
    this._guestToken = token;
    this.guestChanged.emit(context);
  }

  getCurrentGuest(): GuestContext | undefined {
    return this._getCurrentGuest(false);
  }
  getCurrentUser(): IAuthenticatedUser | undefined {
    return this._getCurrentUser(false);
  }
  private _getCurrentUser(forceUpdate: boolean): IAuthenticatedUser | undefined {
    if (!forceUpdate && this._userContext != null) {
      return this._userContext;
    }

    let memberJwtString = this.getMemberTokenFromStorage();
    if (!memberJwtString) {
      this.updateUserContext(undefined, undefined);
      return;
    }
    const memberToken = this.parseToken(memberJwtString);
    const user = memberToken?.user;
    let guestJwtString = this.getguestTokenFromStorage();
    if (guestJwtString) {
      try { this.logOutGuest(); } catch { /* non-critical */ }
    }
    if (memberJwtString) {
      this.updateUserContext(undefined, undefined);
    }
    if (user == null) {
      this.updateUserContext(undefined, undefined);
      return;
    }
    this.updateUserContext({ ...user }, memberJwtString);

    // Routes live in the JWT but are only written to (session) storage at login.
    // On rehydration after a tab/browser restart, sessionStorage is gone while the
    // localStorage token persists — so restore routes from the token here too.
    try {
      this.saveMemberRoutes((memberToken as any)?.routes ?? []);
    } catch { /* non-critical */ }

    if (this._timeout != null) {
      clearTimeout(this._timeout);
    }

    if (memberToken?.exp) {
      const now = new Date().getTime();
      const expires = parseInt(memberToken.exp as any) * 1000;
      const diff = expires - now;
      if (diff > 0) {
        this._timeout = setTimeout(() => {
          this._getCurrentUser(true);
        }, diff + 1000) as any;
      }
    }

    return this._userContext;
  }
  private _getCurrentGuest(forceUpdate: boolean): GuestContext | undefined {
    if (!forceUpdate && this._guestContext != null) {
      return this._guestContext;
    }
    let guestJwtString = this.getguestTokenFromStorage();

    if (!guestJwtString) {
      this.updateguestContext(undefined, undefined);
      return;
    }
    const guestToken = this.parseToken(guestJwtString);
    const guest = guestToken?.user;

    if (guest == null) {
      this.updateguestContext(undefined, undefined);
      return;
    }
    this.updateguestContext({ ...guest }, guestJwtString);

    if (this._timeout != null) {
      clearTimeout(this._timeout);
    }

    if (guestToken?.exp) {
      const now = new Date().getTime();
      const expires = parseInt(guestToken.exp as any) * 1000;
      const diff = expires - now;
      if (diff > 0) {
        this._timeout = setTimeout(() => {
          this._getCurrentGuest(true);
        }, diff + 1000) as any;
      }
    }

    return this._guestContext;
  }

  private saveTransactionToken(tranactionToken: string) {
    if (!this.isBrowser) return;
    localStorage?.setItem(TRANSACTION_TOKEN_NAME, tranactionToken);
  }
  private saveMemberToken(memberJwt: string) {
    if (!this.isBrowser) return;
    const existingguestToken = this.getguestTokenFromStorage();
    if (existingguestToken) this.deleteguestToken();
    localStorage?.setItem(MEMBER_TOKEN_NAME, memberJwt);
  }
  private saveguestToken(guestJwt: string) {
    if (!this.isBrowser) return;
    const existingMemberToken = this.getMemberTokenFromStorage();
    if (existingMemberToken) this.deleteMemberToken();
    localStorage?.setItem(GUEST_TOKEN_NAME, guestJwt);
  }
  private get isBrowser(): boolean {
    return typeof window === "object";
  }

  private parseToken(jwt: string): MemberToken | null {
    const segments = jwt.split('.');
    if (segments.length !== 3) {
      // console.error('Invalid JWT: does not contain 3 segments');
      return null;
    }

    const encodedPayload = segments[1].replace(/-/g, '+').replace(/_/g, '/');

    try {
      const decodedPayload = window.atob(encodedPayload);
      return JSON.parse(decodedPayload) as MemberToken;
    } catch (error) {
      console.error('Error decoding JWT payload', error, '[MemberService.ts]');
      // For production, consider removing the alert and handling the error more gracefully
      alert('Error decoding JWT payload: ' + JSON.stringify(error));
      return null;
    }
  }

  private deleteguestToken() {
    if (this.isBrowser) {
      localStorage?.removeItem(GUEST_TOKEN_NAME);
    }
  }
  private deleteMemberToken() {
    if (this.isBrowser) {
      localStorage?.removeItem(MEMBER_TOKEN_NAME);
    }
  }
  private getguestTokenFromStorage(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    const jwt = localStorage?.getItem(GUEST_TOKEN_NAME);
    if (jwt == null) {
      return null;
    }
    const token = this.parseToken(jwt);
    if (token == null) {
      this.deleteguestToken();
      return null;
    }
    return jwt;
  }

  private getMemberTokenFromStorage(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    const jwt = localStorage?.getItem(MEMBER_TOKEN_NAME);
    if (jwt == null) {
      return null;
    }
    const token = this.parseToken(jwt);
    if (token == null) {
      this.deleteMemberToken();
      return null;
    }
    return jwt;
  }

  getCurrentUserToken(): string | undefined {
    return this._userToken;
  }
  getCurrentGuestToken(): string | undefined {
    return this._guestToken;
  }

  // ── Dynamic routes (clearance-gated, from backend) ─────────────────────
  public getMemberRoutes(): IDynamicRoute[] {
    if (!this.isBrowser) return [];
    try {
      const raw = sessionStorage?.getItem(MEMBER_ROUTES_NAME);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as IDynamicRoute[]) : [];
    } catch {
      return [];
    }
  }
  public saveMemberRoutes(routes: IDynamicRoute[] | null | undefined): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage?.setItem(MEMBER_ROUTES_NAME, JSON.stringify(routes ?? []));
      this.userChanged.emit(this._userContext);
    } catch (e) {
      console.warn("[MemberService.saveMemberRoutes] failed:", e);
    }
  }
  private deleteMemberRoutes() {
    if (!this.isBrowser) return;
    sessionStorage?.removeItem(MEMBER_ROUTES_NAME);
  }
  // ── Site settings (Canopy layout, last event, preferences) ─────────────

  public async getSiteSettings(customerId: string): Promise<any> {
    if (!customerId) throw new ApiError("Customer ID is required", 400, "MS.GSS.01");
    try {
      const res = await this.get<any>(`customer/site-settings?customer_id=${encodeURIComponent(customerId)}`);
      return res?.data ?? res;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(error?.message || "Unable to fetch site settings", error?.status || 500, "MS.GSS.02");
    }
  }

  public async saveSiteSettings(customerId: string, settings: any): Promise<any> {
    if (!customerId) throw new ApiError("Customer ID is required", 400, "MS.SSS.01");
    const payload = { ...settings, customer_id: customerId };
    const encrypted = encryptString(JSON.stringify(payload), ENCRYPTION_KEY);
    if (!encrypted) throw new ApiError("Unable to encrypt settings payload", 500, "MS.SSS.02");
    try {
      const res = await this.put<{ data: string }, any>("customer/site-settings", { data: encrypted });
      return res?.data ?? res;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(error?.message || "Unable to save site settings", error?.status || 500, "MS.SSS.03");
    }
  }

  protected appendHeaders(headers: { [key: string]: string }) {
    super.appendHeaders(headers);
    const token = this.getCurrentUserToken() || this.getAuthToken();
    if (token) {
      headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }
    // Developer-friendly token passthrough for proxied calls
    const urlToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
    if (!headers["Authorization"] && urlToken) {
      headers["Authorization"] = urlToken.startsWith("Bearer ") ? urlToken : `Bearer ${urlToken}`;
    }
  }
}
