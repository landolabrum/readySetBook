import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import styles from "./Instagram.scss";
import UiLoader from "@webstack/components/UiLoader/view/UiLoader";
import { useLoader } from "@webstack/components/Loader/Loader";
import { useNotification } from "@webstack/components/Notification/Notification";
import useInstagram from "~/src/core/services/SocialService/hooks/useInstagram";
import InstagramAuthenticate from "../views/InstagramAuthenticate/InstagramAuthenticate";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import {
  IGListResponse,
  IGWhoAmI,
  InstagramAuthResponse,
} from "~/src/core/services/SocialService/ISocialService";

type InstagramProps = {
  user: { id?: string | number;[k: string]: any };
  current?: "configure" | "status";
  autoAuth?: boolean;
};

type View = "loading" | "status" | "configure" | "authenticating";

// gentle background polling
const POLL_INTERVAL_MIN_MS = 5 * 60_000; // 5 minutes
const JITTER_PERCENT = 0.1; // ±10 %

const Instagram: React.FC<InstagramProps> = ({
  user,
  current = "status",
  autoAuth = true,
}) => {
  const stripeId = useMemo(() => (user?.id != null ? String(user.id) : ""), [user]);
  const [view, setView] = useState<View>(stripeId ? current : "loading");

  const [loader, setLoader] = useLoader();
  const [notif, setNotif] = useNotification();
  const ig = useInstagram();

  const [hasAccount, setHasAccount] = useState(false);
  const [username, setUsername] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const [liveTitle, setLiveTitle] = useState<string>("");
  const [liveAudience, setLiveAudience] = useState<"public" | "practice" | "close_friends">("public");
  const [liveInfo, setLiveInfo] = useState<any>(null);

  const [listResp, setListResp] = useState<IGListResponse | null>(null);
  const [whoamiResp, setWhoamiResp] = useState<IGWhoAmI | null>(null);
  const [statusResp, setStatusResp] = useState<InstagramAuthResponse | null>(null);

  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const clearSpinner = useCallback(() => setLoader?.({ active: false }), [setLoader]);
  const spin = useCallback(
    (text: string) =>
      setLoader?.({ active: true, body: text, backgroundColor: "#20202090" }),
    [setLoader]
  );

  const note = useCallback(
    (message: string, opts?: { persistMs?: number }) =>
      setNotif({
        active: true,
        dismissable: true,
        persistence: opts?.persistMs ?? 2500,
        list: [{ label: message }],
      }),
    [setNotif]
  );

  const errorNote = useCallback(
    (message: string, detail?: any) =>
      setNotif({
        active: true,
        dismissable: true,
        apiError: {
          message,
          status: 400,
          detail: detail ?? "",
          error: true,
        },
      }),
    [setNotif]
  );

  // unified backend refresh
  const refreshBackendState = useCallback(async () => {
    if (!stripeId) return;
    try {
      setView((v) => (v === "status" ? v : "loading"));
      const list = await ig.list(stripeId);
      setListResp(list);

      const acc = list?.accounts?.[0];
      const exists = !!acc;
      setHasAccount(exists);
      setUsername(acc?.username || undefined);
      setEmail(acc?.email || undefined);

      if (!exists) {
        setSessionOk(null); 
        setView("configure");
        note("No Instagram account configured yet. Please add it.");
        return;
      }

      const st = await ig.whoami(acc.username);
      setWhoamiResp(st);

      let ok = st?.status === "ok";

      try {
        const status = await ig.status({ stripe_id: stripeId, username: acc.username });
        setStatusResp(status);
        ok = ok || status?.status === "ok";
      } catch (statusErr: any) {
        setStatusResp({ status: "error", error: statusErr?.message || "status_error" });
      }

      setSessionOk(ok);
      setView("status");

      if (ok) {
        note(`Active session for ${acc.username}`);
      } else {
        const reason = st?.error || st?.details || "missing_session";
        setLastError(reason);
        note(`No active session for ${acc.username}. Sign in required.`, {
          persistMs: 3500,
        });
      }
    } catch (e: any) {
      setSessionOk(false);
      setLastError(e?.message || "Could not get session status.");
      setView("status");
      errorNote("Failed to read session status", e?.message);
    }
  }, [ig, stripeId, note, errorNote]);

  // run once on mount
  useEffect(() => {
    if (!stripeId) return;
    let cancelled = false;
    (async () => {
      await refreshBackendState();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [stripeId]);

  // polling every 5 min (with jitter)
  useEffect(() => {
    if (!stripeId || !hasAccount || !username) return;
    if (view !== "status") return; // only poll when idle

    const jitter = 1 + (Math.random() * 2 - 1) * JITTER_PERCENT;
    const nextMs = POLL_INTERVAL_MIN_MS * jitter;

    pollTimer.current = setTimeout(async () => {
      await refreshBackendState();
    }, nextMs);

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = null;
    };
  }, [stripeId, hasAccount, username, view, refreshBackendState]);

  const handleStartAuth = (u?: string) => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    setView("authenticating");
    spin(`signing in: ${u || username || "…"}`);
    note(`Authenticating ${u || username || ""}…`, { persistMs: 1200 });
  };
  const handleFinished = async (ok: boolean) => {
    clearSpinner();
    if (ok) {
      setView("status");
      note("Session established ✔");
      await refreshBackendState();
    } else {
      setView("configure");
    }
  };

  const handleAuthSuccess = async (u?: string) => {
    if (u) setUsername(u);
    await refreshBackendState();
  };

  const handleManualRefresh = async () => {
    spin("refreshing status…");
    try {
      await refreshBackendState();
      note("Status refreshed");
    } catch (e: any) {
      errorNote("Refresh failed", e?.message);
    } finally {
      clearSpinner();
    }
  };

  const handleLogout = async () => {
    if (!stripeId) return;
    spin("logging out…");
    try {
      await ig.logout(stripeId, username || "");
      note("Logged out of Instagram.");
    } catch (e: any) {
      errorNote("Logout failed", e?.message);
    } finally {
      clearSpinner();
      await refreshBackendState();
    }
  };

  const handleReauth = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    setView("configure");
    note("Re-authenticate to create a fresh session.");
  };

  const handleKeepAlive = async () => {
    if (!username) return;
    spin("keeping session alive…");
    try {
      const res = await ig.keepAlive(username);
      if (res?.status === "ok") {
        note(`Session refreshed for ${username}`);
      } else if (res?.warning) {
        note(res.warning, { persistMs: 3500 });
      }
    } catch (e: any) {
      errorNote("Keep-alive failed", e?.message);
    } finally {
      clearSpinner();
    }
  };

  const handleLiveCreate = async () => {
    if (!username) {
      errorNote("Missing username", "Authenticate first");
      return;
    }
    spin("creating live…");
    try {
      const res = await ig.liveCreate({ username, title: liveTitle || username, audience: liveAudience });
      setLiveInfo(res);
      if (res?.status === "ok") {
        note("Live ready – copy stream key", { persistMs: 4000 });
      } else if (res?.error) {
        errorNote("Live create failed", res.error);
      }
    } catch (e: any) {
      errorNote("Live create failed", e?.message);
    } finally {
      clearSpinner();
    }
  };

  if (!stripeId) {
    return (
      <>
        <style jsx>{styles}</style>
        <div className="instagram">
          <div className="instagram--view">
            <div className="error">Missing customer id (stripe_id).</div>
          </div>
        </div>
      </>
    );
  }

  const StatusPanel = () => (
    <div className="ig-status">
      <div className="ig-status__row">
        <div className="ig-status__label">Overall</div>
        <div className={`badge ${sessionOk ? "ok" : "bad"}`}>
          {sessionOk ? "Authenticated" : "Not authenticated"}
        </div>
        <div className={`badge ${hasAccount ? "ok" : "bad"}`}>
          {hasAccount ? "Account saved" : "No account"}
        </div>
        <div className={`badge ${whoamiResp?.status === "ok" ? "ok" : "bad"}`}>
          whoami: {whoamiResp?.status ?? "n/a"}
        </div>
        {statusResp?.status && (
          <div className={`badge ${statusResp.status === "ok" ? "ok" : "bad"}`}>
            status: {statusResp.status}
          </div>
        )}
      </div>

      <div className="ig-status__row">
        <div className="ig-status__label">Username</div>
        <div className="ig-status__value">{username || "—"}</div>
      </div>
      <div className="ig-status__row">
        <div className="ig-status__label">Email</div>
        <div className="ig-status__value">{email || "—"}</div>
      </div>
      <div className="ig-status__row">
        <div className="ig-status__label">Session</div>
        <div className={`badge ${sessionOk ? "ok" : "bad"}`}>
          {sessionOk ? "active" : "not authenticated"}
        </div>
      </div>
      {lastError && <div className="error">{lastError}</div>}

      <div className="ig-status__row">
        <div className="ig-status__label">Last login</div>
        <div className="ig-status__value">
          {listResp?.accounts?.[0]?.last_login || statusResp?.session?.last_login || "—"}
        </div>
      </div>

      <div className="ig-status__row">
        <div className="ig-status__label">WhoAmI</div>
        <div className="ig-status__value">
          {whoamiResp?.account?.username || whoamiResp?.username || "—"}
          {whoamiResp?.account?.full_name ? ` (${whoamiResp.account.full_name})` : ""}
        </div>
      </div>

      <div className="ig-status__row">
        <div className="ig-status__label">Followers</div>
        <div className="ig-status__value">
          {whoamiResp?.account?.follower_count ?? "—"}
        </div>
      </div>

      <div className="ig-status__row">
        <div className="ig-status__label">Device</div>
        <div className="ig-status__value">
          {statusResp?.device?.user_agent || whoamiResp?.device?.user_agent || "—"}
        </div>
      </div>

      {ig.lastAuth?.feed?.items?.length ? (
        <div className="ig-status__row">
          <div className="ig-status__label">Feed items (auth)</div>
          <div className="ig-status__value">{ig.lastAuth.feed.items.length}</div>
        </div>
      ) : null}

      {statusResp?.feed?.items?.length ? (
        <div className="ig-status__row">
          <div className="ig-status__label">Feed items (status)</div>
          <div className="ig-status__value">{statusResp.feed.items.length}</div>
        </div>
      ) : null}

      <div className="ig-status__actions">
        <UiButton
          variant="ghost"
          size="md"
          onClick={handleManualRefresh}
          traits={{ afterIcon: "fas-rotate" }}
        >
          Refresh Status
        </UiButton>

        <UiButton
          variant="ghost"
          size="md"
          onClick={handleKeepAlive}
          traits={{ afterIcon: "fas-heartbeat" }}
        >
          Keep Alive
        </UiButton>

        {sessionOk ? (
          <>
            <UiButton
              variant="solid"
              size="md"
              onClick={handleLogout}
              traits={{ afterIcon: "fas-right-from-bracket" }}
            >
              Logout
            </UiButton>

            <UiButton
              variant="ghost"
              size="md"
              onClick={handleReauth}
              traits={{ afterIcon: "fas-repeat" }}
            >
              Re-authenticate
            </UiButton>
          </>
        ) : (
          <UiButton
            variant="primary"
            size="md"
            onClick={handleReauth}
            traits={{ afterIcon: "fas-sign-in-alt" }}
          >
            Sign In
          </UiButton>
        )}
      </div>

      {sessionOk ? (
        <div className="ig-live">
          <div className="ig-status__row">
            <div className="ig-status__label">Go Live</div>
            <div className="ig-status__value">
              <input
                aria-label="Live title"
                value={liveTitle}
                placeholder="Live title"
                onChange={(e) => setLiveTitle(e.target.value)}
              />
              <select
                aria-label="Audience"
                value={liveAudience}
                onChange={(e) => setLiveAudience(e.target.value as any)}
              >
                <option value="public">Public</option>
                <option value="practice">Practice</option>
                <option value="close_friends">Close friends</option>
              </select>
              <UiButton variant="primary" size="sm" onClick={handleLiveCreate}>
                Get Stream Key
              </UiButton>
            </div>
          </div>

          {liveInfo && (
            <div className="ig-status__row">
              <div className="ig-status__label">Stream Info</div>
              <div className="ig-status__value">
                <div>URL: {liveInfo.stream_url || liveInfo.upload_url || "—"}</div>
                <div>Key: {liveInfo.stream_key || "—"}</div>
                {liveInfo.warning && <div className="error">{liveInfo.warning}</div>}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

  const views: Record<View, React.ReactNode> = {
    loading: <UiLoader height="640px" text="Loading…" />,
    authenticating: <UiLoader height="640px" text="Signing in…" />,
    status: <StatusPanel />,
    configure: (
      <InstagramAuthenticate
        user={user}
        mode={hasAccount ? "signin" : "configure"}
        defaults={{ username, email }}
        hasAccount={hasAccount}
        hasSession={!!sessionOk}
        autoAuth={autoAuth}
        onAuthenticating={handleStartAuth}
        onFinished={handleFinished}
        onSuccess={handleAuthSuccess}
      />
    ),
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="instagram">
        <h1>{view}</h1>
        <div className="instagram--view">{views[view]}</div>
      </div>
      <div className="instagram__tandc">Not Responsible</div>
    </>
  );
};

export default Instagram;
