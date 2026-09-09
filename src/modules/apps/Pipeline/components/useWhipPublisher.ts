import { useCallback, useEffect, useRef, useState } from "react";

export type PublishState = "idle" | "publishing" | "live" | "error";

export type PublishOptions = {
    /** Max target bitrate in kbps for video tracks */
    maxBitrateKbps?: number;
};

type StartResult = { pc: RTCPeerConnection; answerSdp: string };

export type WhipPublisher = {
    start: (stream: MediaStream, whipUrl: string, options?: PublishOptions) => Promise<StartResult>;
    stop: () => void;
    getState: () => PublishState;
    getError: () => string | null;
    /** Subscribe to state/error changes. Returns an unsubscribe fn. */
    subscribe: (listener: (state: PublishState, error: string | null) => void) => () => void;
};

async function fetchWithBackoff(
    url: string,
    init: RequestInit,
    attempts = 3,
    baseDelayMs = 250
): Promise<Response> {
    let lastErr: unknown;

    for (let i = 0; i < attempts; i++) {
        try {
            const resp = await fetch(url, init);
            if (resp.ok) return resp;
            lastErr = new Error(`WHIP publish failed (${resp.status})`);
        } catch (err) {
            lastErr = err;
        }

        const delay = baseDelayMs * 2 ** i;
        await new Promise((r) => setTimeout(r, delay));
    }

    throw lastErr instanceof Error ? lastErr : new Error("WHIP publish failed");
}

function waitForIceComplete(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();

        const onChange = () => {
            if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", onChange);
                resolve();
            }
        };

        pc.addEventListener("icegatheringstatechange", onChange);
    });
}

/**
 * Prefer H264 so MediaMTX can generate HLS.
 * Must be called after tracks are added and before createOffer().
 */
function preferH264(pc: RTCPeerConnection) {
    const caps = RTCRtpSender.getCapabilities?.("video");
    const codecs = caps?.codecs ?? [];
    if (!codecs.length) return;

    const h264 = codecs.filter((c) => (c.mimeType || "").toLowerCase() === "video/h264");
    if (!h264.length) return;

    const rest = codecs.filter((c) => (c.mimeType || "").toLowerCase() !== "video/h264");

    for (const t of pc.getTransceivers()) {
        if (t.sender?.track?.kind !== "video") continue;
        if (!t.setCodecPreferences) continue;
        t.setCodecPreferences([...h264, ...rest]);
    }
}

function applyMaxBitrate(senders: RTCRtpSender[], maxBitrateKbps?: number) {
    const kbps = maxBitrateKbps ?? 0;
    if (kbps <= 0) return;

    const maxBitrate = kbps * 1000;

    for (const sender of senders) {
        if (sender.track?.kind !== "video") continue;

        const params = sender.getParameters();
        const encodings = params.encodings?.length ? params.encodings : [{}];

        params.encodings = encodings.map((enc) => ({ ...enc, maxBitrate }));

        sender.setParameters(params).catch((err) => {
            console.warn("[Pipeline] setParameters(maxBitrate) failed", err);
        });
    }
}

/**
 * Plain (non-React) factory so PipelineProvider can hold N publishers — one per
 * active session — without hitting the rules-of-hooks ceiling. Each instance
 * owns exactly one RTCPeerConnection over its lifetime; calling start() while
 * one is open closes it first (this instance only — never global).
 */
export function createWhipPublisher(): WhipPublisher {
    let pc: RTCPeerConnection | null = null;
    let state: PublishState = "idle";
    let error: string | null = null;
    const listeners = new Set<(s: PublishState, e: string | null) => void>();

    // Auto-reconnect state. Only kicks in after the PC has reached `connected`
    // at least once — initial publish failures are left to the caller (so the
    // user can fix bad creds / server-down rather than us hammering it).
    let lastArgs: { stream: MediaStream; whipUrl: string; options?: PublishOptions } | null = null;
    let userStopped = false;
    let everConnected = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    let disconnectedGraceTimer: number | null = null;
    const RECONNECT_BACKOFF_MS = [1000, 3000, 9000];
    const DISCONNECTED_GRACE_MS = 5000;

    const emit = (next: PublishState, nextError: string | null) => {
        state = next;
        error = nextError;
        listeners.forEach((l) => {
            try { l(state, error); } catch { /* listener fault should not crash publisher */ }
        });
    };

    const clearTimers = () => {
        if (reconnectTimer != null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        if (disconnectedGraceTimer != null) { clearTimeout(disconnectedGraceTimer); disconnectedGraceTimer = null; }
    };

    // Close the current PC without stopping the underlying tracks — the caller
    // owns the MediaStream and we need to be able to re-attach the same tracks
    // when reconnecting.
    const closeCurrentPc = () => {
        if (!pc) return;
        try { pc.close(); } catch { /* best-effort */ }
        pc = null;
    };

    const scheduleReconnect = () => {
        if (userStopped || !lastArgs || !everConnected) return;
        if (reconnectTimer != null) return; // already pending
        if (reconnectAttempt >= RECONNECT_BACKOFF_MS.length) {
            emit("error", "Stream lost — max reconnect attempts reached");
            return;
        }
        const delay = RECONNECT_BACKOFF_MS[reconnectAttempt];
        reconnectAttempt++;
        emit("publishing", null);
        reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            if (userStopped || !lastArgs) return;
            const tracksAlive = lastArgs.stream.getTracks().some((t) => t.readyState === "live");
            if (!tracksAlive) {
                emit("error", "Stream lost — local tracks ended");
                return;
            }
            start(lastArgs.stream, lastArgs.whipUrl, lastArgs.options).catch(() => {
                // start() already emitted "error"; queue the next attempt
                if (!userStopped) scheduleReconnect();
            });
        }, delay);
    };

    const stop = () => {
        userStopped = true;
        everConnected = false;
        reconnectAttempt = 0;
        clearTimers();
        if (pc) {
            try { pc.getSenders().forEach((s) => s.track?.stop()); } catch { /* best-effort */ }
            try { pc.close(); } catch { /* best-effort */ }
            pc = null;
        }
        lastArgs = null;
        emit("idle", null);
    };

    const start = async (stream: MediaStream, whipUrl: string, options?: PublishOptions): Promise<StartResult> => {
        if (!stream) throw new Error("Media stream is required");
        if (!whipUrl) throw new Error("WHIP URL is required");

        userStopped = false;
        lastArgs = { stream, whipUrl, options };
        clearTimers();
        closeCurrentPc();
        emit("publishing", null);

        const nextPc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pc = nextPc;

        nextPc.onconnectionstatechange = () => {
            const s = nextPc.connectionState;
            console.log("[WHIP] connectionState =", s);
            if (s === "connected") {
                everConnected = true;
                reconnectAttempt = 0;
                if (disconnectedGraceTimer != null) {
                    clearTimeout(disconnectedGraceTimer);
                    disconnectedGraceTimer = null;
                }
                return;
            }
            if (s === "failed") {
                if (disconnectedGraceTimer != null) {
                    clearTimeout(disconnectedGraceTimer);
                    disconnectedGraceTimer = null;
                }
                if (everConnected && !userStopped) {
                    scheduleReconnect();
                } else {
                    emit("error", `WebRTC connectionState=${s}`);
                }
                return;
            }
            if (s === "disconnected") {
                // Often transient on mobile; give it a grace window before reconnecting.
                if (disconnectedGraceTimer != null) return;
                disconnectedGraceTimer = window.setTimeout(() => {
                    disconnectedGraceTimer = null;
                    if (userStopped) return;
                    if (nextPc.connectionState === "disconnected" || nextPc.connectionState === "failed") {
                        scheduleReconnect();
                    }
                }, DISCONNECTED_GRACE_MS);
            }
        };
        nextPc.oniceconnectionstatechange = () => {
            console.log("[WHIP] iceConnectionState =", nextPc.iceConnectionState);
        };
        nextPc.onsignalingstatechange = () => {
            console.log("[WHIP] signalingState =", nextPc.signalingState);
        };

        try {
            const senders: RTCRtpSender[] = [];

            for (const track of stream.getTracks()) {
                senders.push(nextPc.addTrack(track, stream));
            }

            preferH264(nextPc);
            applyMaxBitrate(senders, options?.maxBitrateKbps);

            const offer = await nextPc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false,
            });

            await nextPc.setLocalDescription(offer);
            await waitForIceComplete(nextPc);

            const localSdp = nextPc.localDescription?.sdp;
            if (!localSdp) throw new Error("Failed to create local SDP");

            const resp = await fetchWithBackoff(
                whipUrl,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/sdp" },
                    body: localSdp,
                },
                3,
                250
            );

            const answerSdp = await resp.text();
            await nextPc.setRemoteDescription({ type: "answer", sdp: answerSdp });

            emit("live", null);
            return { pc: nextPc, answerSdp };
        } catch (err: any) {
            try { nextPc.close(); } catch { /* best-effort */ }
            if (pc === nextPc) pc = null;

            emit("error", err?.message ?? "Publish failed");
            throw err;
        }
    };

    return {
        start,
        stop,
        getState: () => state,
        getError: () => error,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
}

/**
 * Thin React wrapper around a single createWhipPublisher() instance. Kept for
 * backward compatibility with any code that still expects the hook shape.
 * PipelineProvider no longer uses this — it owns N factory publishers directly.
 */
export function useWhipPublisher() {
    const publisherRef = useRef<WhipPublisher | null>(null);
    if (publisherRef.current == null) publisherRef.current = createWhipPublisher();

    const [state, setState] = useState<PublishState>("idle");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const pub = publisherRef.current!;
        const unsub = pub.subscribe((s, e) => {
            setState(s);
            setError(e);
        });
        return () => {
            unsub();
            pub.stop();
        };
    }, []);

    const start = useCallback(
        (stream: MediaStream, whipUrl: string, options?: PublishOptions) =>
            publisherRef.current!.start(stream, whipUrl, options),
        []
    );
    const stop = useCallback(() => publisherRef.current!.stop(), []);

    return { start, stop, state, error } as const;
}
