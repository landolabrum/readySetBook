import { IFormField } from "@webstack/components/UiForm/models/IFormModel";
import axios, { AxiosError } from "axios";

// Single expiry mechanism: whether detected client-side (exp claim) or
// server-side (401 detail), an expired/invalid token is purged everywhere it
// may be stored and the user is sent to login — never a half-authed page.
function purgeAuthAndRedirect() {
  if (typeof window === "undefined") return;
  for (const k of ["auth-token", "access_token", "token"]) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
    try { sessionStorage.removeItem(k); } catch { /* ignore */ }
  }
  try { document.cookie = "auth-token=; Max-Age=0; path=/"; } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("auth:token-expired"));
  // Give the event a moment to propagate before hard-redirecting.
  setTimeout(() => {
    if (window.location.pathname?.includes("/authentication")) {
      window.location.href = "/authentication?mode=expired";
      alert("[ You've been redirected ]")
    }
  }, 1500);
}

/** True when the JWT carries an exp claim in the past (unparseable → not expired). */
function isJwtExpired(token: string): boolean {
  try {
    const raw = token.replace(/^Bearer /, "");
    const payload = JSON.parse(atob(raw.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

// Install once — clears the stored token and redirects to login when the server
// signals that the token is expired or invalid.
let _authInterceptorInstalled = false;
function installAuthInterceptor() {
  if (_authInterceptorInstalled || typeof window === "undefined") return;
  _authInterceptorInstalled = true;
  axios.interceptors.response.use(
    (r) => r,
    (error: AxiosError) => {
      const status = error.response?.status;
      const detail: string = (error.response?.data as any)?.detail ?? "";
      const isTokenError =
        (status === 401 || status === 422) &&
        /token.*expir|expir.*token|signature.*verif|invalid.*token/i.test(detail);
      if (isTokenError) purgeAuthAndRedirect();
      return Promise.reject(error);
    }
  );
}

export default class ApiService {
  constructor(private apiEndpoint: string) {
    // Ensure cookies (e.g., HttpOnly JWT) are sent with cross-origin API calls.
    axios.defaults.withCredentials = true;
    installAuthInterceptor();
  }

  /* -------------------- HTTP helpers -------------------- */

  protected get<T>(uri: string, responseType: "json" | "blob" = "json"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      axios
        .get<T>(this.getFullUrl(uri), {
          headers: this.getDefaultHeaders(),
          responseType,
        })
        .then((resp) => resolve(resp.data))
        .catch((error: AxiosError) => reject(this.createApiErrorForAxios(error)));
    });
  }

  protected post<TInput, TResult>(
    uri: string,
    input?: TInput,
    headers?: { [key: string]: string }
  ): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      const isFormData = input instanceof FormData;

      const postHeaders = this.getDefaultHeaders();
      if (headers != null) Object.assign(postHeaders, headers);

      // Let browser set boundary for FormData
      if (isFormData) delete (postHeaders as any)["Content-Type"];

      axios
        .post<TResult>(this.getFullUrl(uri), input, { headers: postHeaders })
        .then((resp) => resolve(resp.data))
        .catch((error: AxiosError) => reject(this.createApiErrorForAxios(error)));
    });
  }

  protected put<TInput, TResult>(
    uri: string,
    input: TInput,
    headers?: { [key: string]: string }
  ): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      const putHeaders = this.getDefaultHeaders();
      if (headers != null) Object.assign(putHeaders, headers);

      axios
        .put<TResult>(this.getFullUrl(uri), input, { headers: putHeaders })
        .then((resp) => resolve(resp.data))
        .catch((error: AxiosError) => reject(this.createApiErrorForAxios(error)));
    });
  }

  protected patch<TInput, TResult>(
    uri: string,
    input: TInput,
    headers?: { [key: string]: string }
  ): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      const patchHeaders = this.getDefaultHeaders();
      if (headers != null) Object.assign(patchHeaders, headers);

      axios
        .patch<TResult>(this.getFullUrl(uri), input, { headers: patchHeaders })
        .then((resp) => resolve(resp.data))
        .catch((error: AxiosError) => reject(this.createApiErrorForAxios(error)));
    });
  }
  // ApiService.ts
  protected delete<TResult>(uri: string): Promise<TResult>;
  protected delete<TInput, TResult>(
    uri: string,
    input: TInput,
    headers?: { [key: string]: string }
  ): Promise<TResult>;
  protected delete<TInput, TResult>(
    uri: string,
    input?: TInput,
    headers?: { [key: string]: string }
  ): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      const delHeaders = this.getDefaultHeaders();
      if (headers != null) Object.assign(delHeaders, headers);

      axios
        .delete<TResult>(this.getFullUrl(uri), {
          headers: delHeaders,
          // IMPORTANT: Axios sends a body for DELETE via the `data` field
          data: input ?? {}, // your FastAPI handler reads JSON here
        })
        .then((resp) => resolve(resp.data))
        .catch((error: AxiosError) => reject(this.createApiErrorForAxios(error)));
    });
  }

  // protected delete<TResult>(uri: string): Promise<TResult> {
  //   return new Promise<TResult>((resolve, reject) => {
  //     axios
  //       .delete<TResult>(this.getFullUrl(uri), {
  //         headers: this.getDefaultHeaders(),
  //       })
  //       .then((resp) => resolve(resp.data))
  //       .catch((error: AxiosError) => reject(this.createApiErrorForAxios(error)));
  //   });
  // }

  // Attach Authorization header if a token exists. Accepts a token with or without "Bearer " prefix.
  protected getDefaultHeaders(): { [key: string]: string } {
    const headers: { [key: string]: string } = {};
    this.appendHeaders(headers);

    const token = this.getAuthToken();
    if (token) {
      headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }
    return headers;
  }

  // Look up token from localStorage/sessionStorage/cookie (non-HttpOnly).
  // An expired token is never returned: it is purged and the user is sent to
  // login, so requests can't go out half-authed against protected routes.
  protected getAuthToken(): string | null {
    let token: string | null = null;
    try {
      if (typeof localStorage !== "undefined") {
        for (const k of ["auth-token", "access_token", "token"]) {
          const v = localStorage.getItem(k);
          if (v) { token = v; break; }
        }
      }
      if (!token && typeof sessionStorage !== "undefined") {
        for (const k of ["auth-token", "access_token", "token"]) {
          const v = sessionStorage.getItem(k);
          if (v) { token = v; break; }
        }
      }
      if (!token && typeof document !== "undefined") {
        const m = document.cookie.match(/(?:^|; )auth-token=([^;]+)/);
        if (m) token = decodeURIComponent(m[1]);
      }
    } catch {
      /* ignore */
    }
    if (token && isJwtExpired(token)) {
      purgeAuthAndRedirect();
      return null;
    }
    return token;
  }

  /** Default headers you can extend in subclasses. */
  // eslint-disable-next-line class-methods-use-this
  protected appendHeaders(headers: { [key: string]: string }) {
    headers["Cache-Control"] = "no-cache";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
    headers["Content-Type"] = "application/json";
  }

  /* -------------------- URL helpers -------------------- */

  protected getFullUrl(uri: string): string {
    if (!uri) throw Error("URI required");

    // Allow callers to pass a fully-qualified URL.
    if (/^https?:\/\//i.test(uri)) return uri;

    // If apiEndpoint is missing/empty on the client, fall back to same-origin.
    // This prevents silent failures where services throw before any request
    // appears in the Network tab.
    if (!this.apiEndpoint) {
      if (typeof window === "undefined") throw Error("apiEndpoint missing");
      if (uri[0] !== "/") uri = "/" + uri;
      return uri;
    }

    const apiUrlendsWithSlash = this.apiEndpoint[this.apiEndpoint.length - 1] === "/";
    const endpointUrlbeginsWithSlash = uri[0] === "/";
    if (!apiUrlendsWithSlash && !endpointUrlbeginsWithSlash) uri = "/" + uri;
    if (uri.includes("/https://")) return uri.replace("/", "");
    return this.apiEndpoint + uri;
  }

  /* -------------------- error shaping -------------------- */

  protected createApiErrorForAxios(error: any): ApiError {
    if (!error?.isAxiosError) return new ApiError("Unhandled error", 500);

    if (error.response) {
      const response: any = error.response;
      const data: any = response.data ?? {};
      const rawTitle = data.title || data.detail || error.message || "Unhandled Error";
      const title = typeof rawTitle === "string" ? rawTitle : (rawTitle?.detail ?? JSON.stringify(rawTitle));

      if (data?.detail?.fields)
        return new FormFieldsException(data.detail.fields, response.status, data?.code);
      return new ApiError(title, response.status, data?.code, data);
    }

    if (error.request) return new ApiError("No response was received");
    return new ApiError("Unhandled Error");
  }
}

/* -------------------- error types -------------------- */

export class ApiError {
  public status?: number;
  public message?: string;
  public error?: boolean;
  public detail?: any;

  constructor(message?: string, status?: number, code?: string, detail?: any) {
    this.message = message ?? "Unhandled Error";
    this.status = status;
    this.detail = detail;
    this.error = true;
  }
}

export class FormFieldsException extends ApiError {
  public fields?: IFormField[];

  constructor(fields?: IFormField[], status?: number, code?: string) {
    super("Form validation error", status, code);
    this.fields = fields;
    this.error = true;
  }
}
