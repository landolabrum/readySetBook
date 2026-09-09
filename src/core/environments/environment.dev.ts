// environment.dev.ts
import { IEnvironment, Merchant } from "./environment.interface";
import merchants, { deploy } from "~/merchants.config";
import { MerchantsConfig } from "./environment.interface";

// Avoid "undefined" API bases by normalizing env vars and falling back to same-origin on the client.
const normalize = (value?: string) => (value ?? "").trim();
const resolveServerUrl = (): string => {
  const explicitBase = normalize(process.env.NEXT_PUBLIC_API_BASE)
    || normalize(process.env.NEXT_PUBLIC_API_BASE);
  if (explicitBase) return explicitBase;

  if (typeof window !== "undefined" && window.location.origin) {
    const loc = window.location;
    // When the Next.js dev server runs on 3000, default the API to localhost:8000
    if (String(loc.port) === "3000") {
      return "http://localhost:8000";
    }
    return loc.origin;
  }

  return "http://localhost:8000"; // server-side fallback for local dev
};

const serverUrl = resolveServerUrl();
const fileServerBaseUrl = normalize(process.env.NEXT_PUBLIC_FILESERVER_BASE_URL) || serverUrl;
let merchant: Merchant = (merchants as MerchantsConfig).merchants[deploy];
merchant.dir = fileServerBaseUrl + merchant.mid;

const devEnvironment: IEnvironment = {
  useMockApi: false,
  isProduction: true,
  merchant: {
    ...merchant,
    url: 'https://local.tiktok.soy',

    // url: 'http://localhost:3000',
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
    admin: `${serverUrl}`,
    gpt: `${serverUrl}`,
  },
  firebase: {
    webApiKey: '',
    authDomain: '',
    projectId: '',
  }

};

export default devEnvironment;