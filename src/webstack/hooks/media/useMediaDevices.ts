import { useCallback, useEffect, useState } from "react";

export type MediaDevice = {
    deviceId: string;
    kind: MediaDeviceKind;
    label: string;
    groupId?: string;
};

export type MediaDeviceState = {
    cameras: MediaDevice[];
    mics: MediaDevice[];
    outputs: MediaDevice[];
    loading: boolean;
};

const mapDevice = (d: MediaDeviceInfo): MediaDevice => ({
    deviceId: d.deviceId,
    kind: d.kind,
    label: d.label || d.deviceId || "Unknown",
    groupId: (d as any).groupId,
});

const useMediaDevices = () => {
    const [state, setState] = useState<MediaDeviceState>({
        cameras: [],
        mics: [],
        outputs: [],
        loading: true,
    });

    const enumerate = useCallback(async () => {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
            setState({ cameras: [], mics: [], outputs: [], loading: false });
            return;
        }
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter((d) => d.kind === "videoinput").map(mapDevice);
            const mics = devices.filter((d) => d.kind === "audioinput").map(mapDevice);
            const outputs = devices.filter((d) => d.kind === "audiooutput").map(mapDevice);
            setState({ cameras, mics, outputs, loading: false });
        } catch (err) {
            console.error("[Pipeline] enumerateDevices failed", err);
            setState({ cameras: [], mics: [], outputs: [], loading: false });
        }
    }, []);

    useEffect(() => {
        enumerate();
        const handler = () => enumerate();
        navigator.mediaDevices?.addEventListener("devicechange", handler);
        return () => navigator.mediaDevices?.removeEventListener("devicechange", handler);
    }, [enumerate]);

    return { ...state, refresh: enumerate } as const;
};

export default useMediaDevices;
