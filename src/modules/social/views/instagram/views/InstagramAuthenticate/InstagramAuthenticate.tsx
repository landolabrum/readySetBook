import React, { useMemo, useState, useCallback, useEffect } from "react";
import styles from "./InstagramAuthenticate.scss";
import UiForm from "@webstack/components/UiForm/controller/UiForm";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import { IFormField } from "@webstack/components/UiForm/models/IFormModel";
import { useNotification } from "@webstack/components/Notification/Notification";
import { useLoader } from "@webstack/components/Loader/Loader";
import useInstagram from "~/src/core/services/SocialService/hooks/useInstagram";

type Props = {
  user: { id?: string | number;[k: string]: any };
  mode: "signin" | "configure";
  defaults?: { username?: string; email?: string };
  hasAccount?: boolean;
  hasSession?: boolean;
  autoAuth?: boolean;
  onAuthenticating?: (username?: string) => void;
  onFinished?: (ok: boolean) => void;
  onSuccess?: (username?: string) => void;
};

type AuthResult = {
  status: "ok" | "error";
  username?: string;
  error?: string;
  details?: string;
  hint?: string;
  actions?: string[];
  [k: string]: any;
};

const InstagramAuthenticate: React.FC<Props> = ({
  user,
  defaults,
  hasAccount,
  hasSession,
  onAuthenticating,
  onFinished,
  onSuccess,
}) => {
  const stripe_id = useMemo(() => (user?.id != null ? String(user.id) : ""), [user]);
  const ig = useInstagram();
  const [notif, setNotif] = useNotification();
  const [loader, setLoader] = useLoader();

  // ───────────────────────── form model (UiForm) ─────────────────────────
  const [fields, setFields] = useState<IFormField[]>([
    {
      name: "username",
      label: "Username",
      type: "text",
      autoComplete: "off",
      placeholder: "your_username",
      value: defaults?.username || "",
      required: true,
    },
    {
      name: "email",
      label: "Email",
      type: "text",
      autoComplete: "on",
      placeholder: "you@example.com",
      value: defaults?.email || "",
      required: true,
    },
    {
      name: "ig_password",
      label: "IG Password",
      type: "password",
      autoComplete: "on",
      placeholder: "••••••••••",
      value: "",
      required: false,
      traits: { afterIcon: { icon: "fas-eye-slash" } },
    },
    {
      name: "two_fa_enabled",
      label: "2FA Enabled",
      type: "checkbox",
      value: true,
    },
    {
      name: "imap_username",
      label: "IMAP Username",
      type: "text",
      placeholder: defaults?.email || "email alias for OTP",
      value: defaults?.email || "",
    },
    {
      name: "imap_password",
      label: "IMAP App Password",
      type: "password",
      placeholder: "app password for email",
      value: "",
      traits: { afterIcon: { icon: "fas-eye-slash" } },
    },
    {
      name: "imap_host",
      label: "IMAP Host",
      type: "text",
      value: "imap.gmail.com",
      placeholder: "imap.gmail.com",
    },
    {
      name: "imap_port",
      label: "IMAP Port",
      type: "pill",
      min: 1,
      max: 65535,
      value: 993,
    },
    {
      name: "imap_folder",
      label: "IMAP Folder",
      type: "text",
      value: "INBOX",
      placeholder: "INBOX",
    },
    {
      name: "imap_tls",
      label: "IMAP TLS",
      type: "checkbox",
      value: true,
    },
    {
      name: "attempt_wall_timeout",
      label: "Max Attempt (s)",
      type: "pill",
      min: 1,
      max: 60,
      value: 25,
    },
    {
      name: "connect_timeout",
      label: "Connect Timeout",
      type: "pill",
      min: 1,
      max: 60,
      value: 5,
    },
    {
      name: "read_timeout",
      label: "Read Timeout",
      type: "pill",
      min: 1,
      max: 120,
      value: 10,
      width: "220px",
    },
    {
      name: "reset_session",
      label: "Reset Session",
      type: "checkbox",
      value: false,
    },
    {
      name: "debug",
      label: "Debug Logs",
      type: "checkbox",
      value: false,
    },
    {
      name: "proxy",
      label: "Proxy (optional)",
      type: "text",
      placeholder: "http://user:pass@host:port",
      value: "",
    },
  ]);

  // Error panel content from last backend response
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverHint, setServerHint] = useState<string | null>(null);
  const [serverActions, setServerActions] = useState<string[]>([]);
  const [needsConfig, setNeedsConfig] = useState<boolean>(!(hasAccount ?? false));
  const [statusSummary, setStatusSummary] = useState<string | null>(null);

  useEffect(() => {
    setNeedsConfig(!(hasAccount ?? false));
  }, [hasAccount]);

  const spin = useCallback(
    (active: boolean, body?: string) =>
      setLoader?.({ active, body, backgroundColor: "#20202090" }),
    [setLoader]
  );

  const toast = useCallback(
    (title: string, body?: string) =>
      setNotif({
        active: true,
        dismissable: true,
        persistence: 3500,
        list: [{ label: title }, ...(body ? [{ label: body }] : [])],
      }),
    [setNotif]
  );

  const withTimeout = useCallback(
    async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
        }, ms);
      });

      try {
        const result = await Promise.race([promise, timeout]);
        return result as T;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    []
  );

  // UiForm onChange: expects e.target.{name,value}
  const handleChange = useCallback(
    (e: any) => {
      const { name } = e?.target || {};
      if (!name) return;

      const incomingValue = (() => {
        if (e?.target?.type === "checkbox") return Boolean(e?.target?.checked);
        return e?.target?.value;
      })();

      setFields((prev: IFormField[]) =>
        prev.map((f: IFormField) => {
          if (f.name === name) {
            return { ...f, error: undefined, value: incomingValue };
          }
          // Keep IMAP fields disabled when 2FA is off
          if (name === "two_fa_enabled" && [
            "imap_username",
            "imap_password",
            "imap_host",
            "imap_port",
            "imap_folder",
            "imap_tls",
          ].includes(f.name)) {
            return { ...f, disabled: !incomingValue } as IFormField;
          }
          return f;
        })
      );

      // If the username is changed away from the saved/default value, force configure on next submit
      if (name === "username") {
        const nextUsername = String(incomingValue || "").trim();
        const baseline = String(defaults?.username || "").trim();
        if (nextUsername && nextUsername !== baseline) {
          setNeedsConfig(true);
        }
      }
    },
    [setFields, defaults]
  );

  const val = useCallback(
    (name: string) => fields.find((f) => f.name === name)?.value,
    [fields]
  );

  const quickSessionLogin = async () => {
    setServerError(null);
    setServerHint(null);
    setServerActions([]);
    setStatusSummary(null);

    const username = String(val("username") || "").trim();
    if (!username) {
      toast("Username is required to reuse a session.");
      setFields((prev) => prev.map((f) => (f.name === "username" ? { ...f, error: "required" } : f)));
      return;
    }

    spin(true, `Checking session for ${username}…`);
    onAuthenticating?.(username);
    try {
      const res = await ig.whoami(username);
      if (res?.status === "ok") {
        toast("Active session found ✔");
        onSuccess?.(username);
        onFinished?.(true);
        return;
      }

      const detail = res?.details || res?.error || res?.note || "No active session. Sign in required.";
      setServerError(detail);
      setServerActions(Array.isArray(res?.actions) ? res.actions : []);
      toast("No active session", detail);
      if (res?.status === "missing_session") {
        setNeedsConfig(!(hasAccount ?? false));
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to reuse session.";
      setServerError(msg);
      toast("Session check failed", msg);
    } finally {
      spin(false);
    }
  };

  // Submit → call backend authenticate
  const submit = async () => {
    setServerError(null);
    setServerHint(null);
    setServerActions([]);
    setStatusSummary(null);

    const username = String(val("username") || "").trim();
    const email = String(val("email") || defaults?.email || "").trim();
    const ig_password = String(val("ig_password") || "");
    const two_fa_enabled = Boolean(val("two_fa_enabled") ?? true);

    const imap_username = String(val("imap_username") || email);
    const imap_password = String(val("imap_password") || "");
    const imap_host = String(val("imap_host") || "imap.gmail.com");
    const imap_port = Number(val("imap_port") ?? 993);
    const imap_folder = String(val("imap_folder") || "INBOX");
    const imap_tls = Boolean(val("imap_tls") ?? true);

    const attempt_wall_timeout = Number(val("attempt_wall_timeout") ?? 25);
    const connect_timeout = Number(val("connect_timeout") ?? 5);
    const read_timeout = Number(val("read_timeout") ?? 10);
    const reset_session = Boolean(val("reset_session"));
    const debug = Boolean(val("debug"));
    const proxy = String(val("proxy") || "");

    if (!stripe_id) {
      toast("Missing customer id (stripe_id).");
      return;
    }

    if (!username) {
      toast("Username is required.");
      setFields((prev) => prev.map((f) => (f.name === "username" ? { ...f, error: "required" } : f)));
      return;
    }

    if (needsConfig) {
      const errors: string[] = [];
      if (!email) {
        errors.push("Email is required to configure.");
        setFields((prev) => prev.map((f) => (f.name === "email" ? { ...f, error: "required" } : f)));
      }
      if (!ig_password) {
        errors.push("IG password is required to configure.");
        setFields((prev) => prev.map((f) => (f.name === "ig_password" ? { ...f, error: "required" } : f)));
      }
      if (two_fa_enabled) {
        if (!imap_username) {
          errors.push("IMAP username is required when 2FA is enabled.");
          setFields((prev) => prev.map((f) => (f.name === "imap_username" ? { ...f, error: "required" } : f)));
        }
        if (!imap_password) {
          errors.push("IMAP password is required when 2FA is enabled.");
          setFields((prev) => prev.map((f) => (f.name === "imap_password" ? { ...f, error: "required" } : f)));
        }
      }
      if (errors.length) {
        toast("Missing required fields", errors.join("\n"));
        return;
      }
    }

    spin(true, `Signing in as ${username}…`);
    onAuthenticating?.(username);

    try {
      // Optional configure first when we know no config exists
      if (needsConfig) {
        const cfgPayload = {
          username,
          email,
          stripe_id,
          ig_password,
          proxy: proxy || undefined,
          two_fa_enabled,
          imap_host,
          imap_port,
          imap_username,
          imap_password,
          imap_folder,
          imap_tls,
        } as any;

        await ig.configure(cfgPayload);
        toast("Configuration saved", "Proceeding to login with saved credentials.");
        setNeedsConfig(false);
      }

      // 🔑 IMPORTANT: backend expects ig_password (not password)
      const payload = {
        username,
        ig_password,
        stripe_id,
        attempt_wall_timeout,
        connect_timeout,
        read_timeout,
        reset_session,
        debug,
        two_fa_enabled,
        ...(proxy ? { proxy } : {}),
      };

      const authTimeoutMs = Math.max(10, attempt_wall_timeout || 25) * 1000 + 5000;

      const res: AuthResult = await withTimeout(
        ig.authenticate(payload, {
          auth_proxy: Boolean(proxy),
        }),
        authTimeoutMs,
        "Authentication"
      );

      if (res?.status === "ok") {
        const feedWarning = (res as any)?.feed?.warning || (res as any)?.warning;
        if (feedWarning) {
          setServerHint(feedWarning);
          toast("Logged in with warning", feedWarning);
        } else {
          toast("Session established ✔");
        }
        onSuccess?.(username);
        onFinished?.(true);
        return;
      }

      // Error path: surface everything + actions
      const meta = res?.meta as any;
      const metaSummary = (() => {
        if (!meta) return "";
        const bits: string[] = [];
        if (meta?.status_code) bits.push(`status_code ${meta.status_code}`);
        if (meta?.error_type) bits.push(String(meta.error_type));
        const respMsg = meta?.response?.message || meta?.response?.error_message;
        if (respMsg) bits.push(String(respMsg));
        return bits.join(" • ");
      })();

      const detail =
        res?.details ||
        res?.error ||
        metaSummary ||
        "Authentication failed.";
      const hint = res?.hint || metaSummary || "";

      const autoActions: string[] = [];
      if (meta?.status_code === 429 || /please wait/i.test(meta?.response?.message || "")) {
        autoActions.push("backoff", "retry");
      }
      if (/bad_password|invalid_credentials/i.test(meta?.error_type || "")) {
        autoActions.push("retry");
      }
      if (/session|nonce/i.test(meta?.response?.message || "")) {
        autoActions.push("reset_session");
      }
      const actionList = Array.from(new Set([...(Array.isArray(res?.actions) ? res.actions : []), ...autoActions]));

      setServerError(detail);
      setServerHint(hint || null);
      setServerActions(actionList);
      setStatusSummary(metaSummary || detail || null);
      if (res?.error === "no_config_for_user") {
        setNeedsConfig(true);
      }
      toast(res?.error || "Authentication failed", `${detail}${hint ? `\n\n${hint}` : ""}`);
      onFinished?.(false);
    } catch (e: any) {
      const msg = e?.message || "Network/Server error during authentication.";
      setServerError(msg);
      setStatusSummary(msg);
      toast("Authentication failed", msg);
      onFinished?.(false);
    } finally {
      spin(false);
    }
  };

  // Action buttons from backend (always UiButton)
  const ActionButtons = () => {
    if (!serverActions?.length) return null;
    const unique = Array.from(new Set(serverActions));
    return (
      <div className="auth-actions">
        {unique.map((a) => {
          switch (a) {
            case "retry":
              return (
                <UiButton key="retry" onClick={submit}>
                  Try Again
                </UiButton>
              );
            case "open_configure":
              return (
                <UiButton
                  key="open_configure"
                  variant="ghost"
                  onClick={() => {
                    setNeedsConfig(true);
                    toast(
                      "Open Configure",
                      "Switch to Configure to update IMAP/Proxy/Password."
                    );
                  }
                  }
                >
                  Open Configure
                </UiButton>
              );
            case "toggle_proxy": {
              const current = String(val("proxy") || "");
              const next =
                current.trim() === ""
                  ? "http://user:pass@host:port"
                  : "";
              return (
                <UiButton
                  key="toggle_proxy"
                  variant="ghost"
                  onClick={() =>
                    handleChange({ target: { name: "proxy", value: next } })
                  }
                >
                  {current ? "Disable Proxy" : "Enable Proxy"}
                </UiButton>
              );
            }
            case "check_imap":
              return (
                <UiButton
                  key="check_imap"
                  variant="ghost"
                  onClick={() =>
                    toast(
                      "Check IMAP",
                      "Verify IMAP app password & folder; make sure EMAIL challenge is visible."
                    )
                  }
                >
                  Check IMAP
                </UiButton>
              );
            case "backoff":
              return (
                <UiButton
                  key="backoff"
                  variant="ghost"
                  onClick={() =>
                    toast("Rate Limited", "Wait 10–15 minutes, then try again.")
                  }
                >
                  Wait & Retry
                </UiButton>
              );
            case "reset_session": {
              const current = Boolean(val("reset_session"));
              return (
                <UiButton
                  key="reset_session"
                  variant="ghost"
                  onClick={() =>
                    handleChange({
                      target: { name: "reset_session", value: !current },
                    })
                  }
                >
                  {current ? "Use Existing Session" : "Reset Session Next Try"}
                </UiButton>
              );
            }
            default:
              return null;
          }
        })}
      </div>
    );
  };

  const QuickActions = () => {
    if (!hasSession) return null;
    return (
      <div className="auth-quick">
        <UiButton variant="primary" size="md" onClick={quickSessionLogin}>
          Login with Active Session
        </UiButton>
      </div>
    );
  };

  const NextSteps = () => {
    const twoFaOn = Boolean(val("two_fa_enabled"));
    const notes: string[] = [];

    if (needsConfig) {
      notes.push("Save configuration (email, password, IMAP) before signing in.");
    }
    if (serverActions.includes("retry")) {
      notes.push("Retry sign-in now with the current settings.");
    }
    if (serverActions.includes("backoff")) {
      notes.push("Rate limited: wait 10–15 minutes, then try again.");
    }
    if (serverActions.includes("reset_session")) {
      notes.push("Toggle Reset Session to force a fresh Instagram session.");
    }
    if (serverActions.includes("toggle_proxy")) {
      notes.push("Consider enabling or disabling the proxy before the next attempt.");
    }
    if (serverActions.includes("check_imap")) {
      notes.push("Check the IMAP app password and inbox visibility for OTP emails.");
    }
    if (twoFaOn) {
      notes.push("2FA is email-based: the app will pull the code from IMAP automatically.");
    } else {
      notes.push("2FA off: enable IMAP + app password if Instagram prompts for email codes.");
    }

    if (!notes.length) return null;

    return (
      <div className="auth-status">
        <div className="auth-status__title">What to do next</div>
        <ul>
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        {statusSummary && <div className="auth-status__summary">Last status: {statusSummary}</div>}
      </div>
    );
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="ig-auth">
        <QuickActions />

        {needsConfig && (
          <div className="auth-hint">
            No configuration found for this username. Provide email + (optional) IMAP details and save.
          </div>
        )}

        <UiForm
          title="Sign in"
          fields={fields}
          onChange={handleChange}
          onSubmit={() => submit()}
          submitText="Sign In"
          variant="default"
        />

        {(serverError || serverHint || serverActions.length > 0) && (
          <div className="auth-error">
            {serverError && (
              <>
                <div className="auth-error__title">Authentication Error</div>
                <div className="auth-error__detail">{serverError}</div>
              </>
            )}
            {serverHint && <div className="auth-error__hint">Hint: {serverHint}</div>}
            <ActionButtons />
          </div>
        )}
        {!serverError && statusSummary && (
          <div className="auth-error auth-error--info">
            <div className="auth-error__title">Status</div>
            <div className="auth-error__detail">{statusSummary}</div>
          </div>
        )}
        <NextSteps />
      </div>
    </>
  );
};

export default InstagramAuthenticate;
