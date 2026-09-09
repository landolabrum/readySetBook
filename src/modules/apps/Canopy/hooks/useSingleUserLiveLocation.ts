import { useEffect, useMemo, useRef, useState } from "react";
import { getService } from "@webstack/common";
import IMemberService from "~/src/core/services/MemberService/IMemberService";
import { normalizeFix } from "../../Guardian/hooks/tracker/helpers";
import { GuardianFix } from "../../Guardian/hooks/tracker/types";

const POLL_INTERVAL_MS = 3000;
const SHARE_KEY = "guardian:shareDeviceId";

const coerceList = (res: any) => {
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res)) return res;
    if (res?.data != null) return [res.data];
    return [];
};

const latestFix = (list: GuardianFix[]): GuardianFix | null => {
    if (!list.length) return null;
    return list.reduce<GuardianFix | null>((acc, cur) => {
        if (!acc) return cur;
        return cur.timestamp > acc.timestamp ? cur : acc;
    }, null);
};

export const useSingleUserLiveLocation = (userId?: string | null) => {
    const memberService = useMemo(() => getService<IMemberService>("IMemberService"), []);
    const [fix, setFix] = useState<GuardianFix | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [shareDeviceId, setShareDeviceId] = useState<string | null>(null);
    const pollInFlightRef = useRef(false);
    const trimmedUser = (userId ?? "").trim();

    // Capture the shared device (if Guardian set one) so we only poll/render that device.
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const stored = window.localStorage?.getItem(SHARE_KEY);
            if (stored) setShareDeviceId(stored.trim() || null);
        } catch {
            /* ignore */
        }
    }, []);

    // Heartbeat for stale detection
    const [clock, setClock] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setClock(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!trimmedUser) {
            setFix(null);
            setError(null);
            return undefined;
        }

        let cancelled = false;

        const fetchLocation = async () => {
            if (pollInFlightRef.current) return;
            pollInFlightRef.current = true;
            try {
                let res: any;
                try {
                    res = await memberService.getUserLocation(trimmedUser, shareDeviceId || undefined);
                } catch (err: any) {
                    const status = err?.statusCode ?? err?.status ?? err?.response?.status;
                    if (status === 404) {
                        if (!cancelled) {
                            setFix(null);
                            setError(null);
                        }
                        return;
                    }
                    throw err;
                }
                const matchesShare = (row: any) => {
                    if (!shareDeviceId) return true;
                    const id = (row?.deviceId || row?.device_id || "").trim();
                    const label = (row?.deviceLabel || row?.device_label || "").trim();
                    return id === shareDeviceId || label === shareDeviceId;
                };
                const rows = coerceList(res)
                    .filter(matchesShare)
                    .map((row: any) => normalizeFix(row, trimmedUser))
                    .filter(Boolean) as GuardianFix[];
                if (cancelled) return;
                setFix(latestFix(rows));
                setError(null);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? "Failed to load user location");
            } finally {
                pollInFlightRef.current = false;
            }
        };

        fetchLocation();
        const id = setInterval(fetchLocation, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
            pollInFlightRef.current = false;
        };
    }, [memberService, shareDeviceId, trimmedUser]);

    const staleSec = useMemo(() => {
        if (!fix?.timestamp) return null;
        const diff = Math.floor((clock - fix.timestamp) / 1000);
        return diff > 5 ? diff : null;
    }, [clock, fix?.timestamp]);

    return { fix, staleSec, error } as const;
};

export default useSingleUserLiveLocation;
