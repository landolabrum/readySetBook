// environment.production.ts
import { IEnvironment, Merchant } from "./environment.interface";
import merchants, { deploy } from "~/merchants.config";
import { MerchantsConfig } from "./environment.interface";

// Normalize env vars and fall back to same-origin if production base is not provided.
const normalize = (value?: string) => (value ?? "").trim();
const resolveServerUrl = (): string => {
  const explicitBase = normalize(process.env.NEXT_PUBLIC_PRODUCTION_SERVER);
  if (explicitBase) return explicitBase;
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  return ""; // allow ApiService to default to same-origin
};

const serverUrl = resolveServerUrl();
// Cast the merchants object to the appropriate type
const fileServerBaseUrl = normalize(process.env.NEXT_PUBLIC_FILESERVER_BASE_URL) || serverUrl;
let merchant: Merchant = (merchants as MerchantsConfig).merchants[deploy];
merchant.dir = fileServerBaseUrl + merchant.mid;
const prodEnvironment: IEnvironment = {
  useMockApi: false,
  isProduction: true,
  merchant: {
    ...merchant,
  },
  legacyJwtCookie: {
    authToken: "auth-token",
    authRoutes: "auth-routes",
    guestToken: "guest-token",
    transactionToken: "transaction-token",
  },
  serviceEndpoints: {
    membership: `${serverUrl}`,
    data: `${serverUrl}`,
    social: `${serverUrl}`,
    distributor: "",
    shopping: `${serverUrl}`,
    home: `${serverUrl}`,
    gpt: `${serverUrl}`,
    admin: `${serverUrl}`,
  },
  firebase: {
    webApiKey: '',
    authDomain: '',
    projectId: '',
  },
};

export default prodEnvironment;
