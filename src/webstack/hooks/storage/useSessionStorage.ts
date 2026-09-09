// useSessionStorage.ts
import { useCallback, useEffect, useState } from "react";

type SessionRecord = Record<string, any>;
type SessionData = SessionRecord | null | undefined;

interface SessionOptions {
  /** Expiration in seconds (legacy) */
  expiry?: number;
  /** Expiration in milliseconds (preferred) */
  expiryMs?: number;
}

const parseItem = (raw: string | null) => {
  if (raw == null) return null;
  try {
    const stored: any = JSON.parse(raw);
    const expiry: number | undefined = stored?.expiry ?? stored?.exp;
    if (expiry && Date.now() > expiry) return { expired: true } as const;

    if (Object.prototype.hasOwnProperty.call(stored, "value")) {
      return { value: stored.value, expiry };
    }
    return { value: stored, expiry };
  } catch {
    // Non-JSON fallback
    return { value: raw as any, expiry: undefined };
  }
};

const useSessionStorage = () => {
  const [sessionData, setSessionData] = useState<SessionData>();
  const [loading, setLoading] = useState<boolean>(true);

  const getSessionData = useCallback((): SessionData => {
    if (typeof window === "undefined" || !window.sessionStorage) return null;

    const result: SessionRecord = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;

      const parsed = parseItem(sessionStorage.getItem(key));
      if (!parsed) continue;
      if ((parsed as any).expired) {
        sessionStorage.removeItem(key!);
        continue;
      }
      result[key] = (parsed as any).value;
    }

    return Object.keys(result).length ? result : null;
  }, []);

  const getSessionItem = useCallback(
    (name: string): { value: any; expiry?: number } | null => {
      const parsed = parseItem(sessionStorage.getItem(name));
      if (!parsed || (parsed as any).expired) {
        if ((parsed as any)?.expired) sessionStorage.removeItem(name);
        return null;
      }
      return parsed as { value: any; expiry?: number };
    },
    []
  );

  const initializeSessionData = useCallback(() => {
    const data = getSessionData();
    setSessionData(data);
    setLoading(false);
  }, [getSessionData]);

  const setSessionItem = useCallback(
    (name: string, value: any, options?: SessionOptions) => {
      try {
        const item =
          typeof value === "object" && value !== null ? { ...value } : { value };

        // Note: `expiry` is in **seconds**; `expiryMs` is in **milliseconds**
        if (options?.expiryMs && options.expiryMs > 0) {
          item.expiry = Date.now() + options.expiryMs;
        } else if (options?.expiry && options.expiry > 0) {
          item.expiry = Date.now() + options.expiry * 1000;
        }

        sessionStorage.setItem(name, JSON.stringify(item));
        initializeSessionData();
      } catch (err) {
        console.error("Failed to set session storage item:", err);
      }
    },
    [initializeSessionData]
  );

  const deleteSessionItem = useCallback(
    (name: string) => {
      sessionStorage.removeItem(name);
      initializeSessionData();
    },
    [initializeSessionData]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.readyState === "complete" || document.readyState === "interactive") {
      initializeSessionData();
      return;
    }
    const handler = () => initializeSessionData();
    window.addEventListener("DOMContentLoaded", handler);
    return () => window.removeEventListener("DOMContentLoaded", handler);
  }, [initializeSessionData]);
 
  return { sessionData, loading, setSessionItem, deleteSessionItem, getSessionItem };
};

export default useSessionStorage;
