import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import PipelineService from "~/src/core/services/PipelineService/PipelineService";

const PipelinePage = dynamic(
    () => import("@/modules/apps/Pipeline/controller/Pipeline"),
    { ssr: false }
);

type Resolved = {
    sessionId: string;
    kind: "camera" | "screen" | "rtmp" | "pull";
    overlayId?: string;
    eventId?: string;
    userId?: string;
};

const PublishByToken = () => {
    const router = useRouter();
    const tokenParam = router.query.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [error, setError] = useState<string | null>(null);
    const [resolved, setResolved] = useState<Resolved | null>(null);

    useEffect(() => {
        if (!router.isReady) return;
        if (!token) {
            setStatus("error");
            setError("Missing invite token.");
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const svc = new PipelineService();
                const result = await svc.resolveToken(token);
                if (cancelled) return;
                if (!result?.overlayId || (result.kind !== "camera" && result.kind !== "screen")) {
                    setStatus("error");
                    setError("This invite is not usable for camera or screen publishing.");
                    return;
                }
                setResolved(result as Resolved);
                const params = new URLSearchParams({
                    kind: result.kind,
                    overlayId: result.overlayId,
                    autoStart: "1",
                });
                if (result.eventId) params.set("eventId", result.eventId);
                if (result.userId) params.set("userId", result.userId);
                // Mutate the URL in place so Pipeline (mounted below) reads the
                // binder-mode params from router.query. Use shallow + replace so
                // the address bar still shows the token route.
                router.replace(
                    { pathname: router.pathname, query: { ...router.query, ...Object.fromEntries(params) } },
                    undefined,
                    { shallow: true },
                ).catch(() => { });
                setStatus("ready");
            } catch (err: any) {
                if (cancelled) return;
                setStatus("error");
                setError(err?.message || "Invite link is invalid or expired.");
            }
        })();
        return () => { cancelled = true; };
    }, [router, token]);

    if (status === "loading") {
        return <div style={{ padding: 24, color: "#fff" }}>Loading invite…</div>;
    }
    if (status === "error") {
        return <div style={{ padding: 24, color: "#ef4444" }}>{error}</div>;
    }
    if (!resolved) return null;
    return <PipelinePage />;
};

export default PublishByToken;
