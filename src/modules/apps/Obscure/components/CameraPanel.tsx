import React, { useEffect, useMemo, useRef, useState } from "react";
import Obscurestyles from "../controller/Obscure.scss";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiForm from "@webstack/components/UiForm/controller/UiForm";
import { classNames } from "@webstack/common";
import { CameraSession } from "../hooks/useObscureCameras";
import { formatTime } from "../utils/time";
import useLocalStorage from "@webstack/hooks/storage/useLocalStorage";
import { STORAGE_KEYS } from "@/modules/apps/Guardian/hooks/tracker/types";
import useLocationPermissions from "@webstack/hooks/user/useLocationPermissions";
import {
    buildDescriptor,
    hydrateDescriptor,
    persistDescriptor,
} from "@/modules/apps/Guardian/hooks/tracker/device";
import { IFormField } from "@webstack/components/UiForm/models/IFormModel";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";

export type CameraPanelProps = {
    sessions: CameraSession[];
    refreshing: boolean;
    creating: boolean;
    onRefresh: () => void;
    onCreate: (input: { label: string; room?: string; ttlSeconds?: number }) => Promise<void>;
    onRevoke: (id: string) => Promise<void>;
};

const statusLabel: Record<CameraSession["status"], string> = {
    pending: "Waiting",
    connected: "Live",
    disconnected: "Paused",
    revoked: "Revoked",
};

const CameraPanel: React.FC<CameraPanelProps> = ({
    sessions,
    refreshing,
    creating,
    onRefresh,
    onCreate,
    onRevoke,
}) => {
    const { getLocalItem, setLocalItem } = useLocalStorage("guardian:tracking");
    const { requestLocation } = useLocationPermissions();
    const [label, setLabel] = useState("");
    const [room, setRoom] = useState("");
    const [ttlSeconds, setTtlSeconds] = useState<number>(6 * 60 * 60);
    const [copying, setCopying] = useState<string | null>(null);
    const [previewId, setPreviewId] = useState<string | null>(null);
    const locationPromptedRef = useRef(false);

    const cameraFormFields = useMemo<IFormField[]>(
        () => [
            {
                name: "cameraLabel",
                label: "Camera label",
                placeholder: "Stage cam, Guest A, Backline…",
                value: label,
                type: "text",
                required: true,
                width: "max-content",
            },
            {
                name: "cameraRoom",
                width: "max-content",
                label: "Room (optional)",
                placeholder: "mindburn-obscure",
                value: room,
                type: "text",
            },
            {
                name: "cameraTtl",
                width: "max-content",
                label: "TTL (seconds)",
                type: "number",
                min: 300,
                max: 24 * 60 * 60,
                // UiForm treats text inputs as strings; keep TTL as
                // string in the field and convert back to number.
                value: String(ttlSeconds || ""),
            },
        ],
        [label, room, ttlSeconds]
    );

    const handleCameraFormChange = (e: any) => {
        const { name, value } = e?.target ?? {};
        if (name === "cameraLabel") {
            setLabel(String(value ?? ""));
        } else if (name === "cameraRoom") {
            setRoom(String(value ?? ""));
        } else if (name === "cameraTtl") {
            setTtlSeconds(Number(value) || 0);
        }
    };

    useEffect(() => {
        if (label) return;

        // 1) Try to hydrate the Guardian device descriptor the same way
        // Guardian does via hydrateDescriptor.
        const hydrated = hydrateDescriptor(getLocalItem);
        if (hydrated?.label) {
            setLabel(hydrated.label);
            return;
        }

        // 2) Fall back to the last Guardian fix payload, which also
        // carries device metadata for active users.
        const storedFix = getLocalItem(STORAGE_KEYS.fix);
        if (storedFix && typeof storedFix === "object") {
            const maybe = storedFix as any;
            const candidate: string | undefined =
                maybe.deviceLabel || maybe.label || maybe.deviceId || maybe.id;
            if (candidate && typeof candidate === "string") {
                setLabel(candidate);
                return;
            }
        }

        // 3) If we still don't have a label, mirror Guardian's
        // location-approval flow: prompt once on-load and, on grant,
        // build + persist a descriptor and use its label.
        if (locationPromptedRef.current) return;
        locationPromptedRef.current = true;

        const nav: Navigator | undefined =
            typeof navigator !== "undefined" ? navigator : undefined;

        requestLocation({
            forceModal: true,
            skipBrowserPrompt: false,
            onGrant: () => {
                const existing = hydrateDescriptor(getLocalItem);
                const descriptor =
                    existing ?? buildDescriptor(getLocalItem?.(STORAGE_KEYS.device), nav);
                if (!descriptor) return;
                persistDescriptor(descriptor, setLocalItem);
                if (!label && descriptor.label) {
                    setLabel(descriptor.label);
                }
            },
            onDeny: () => {
                // User declined; keep the label as-is.
            },
        }).catch(() => {
            // Swallow errors; label simply remains unchanged.
        });
    }, [getLocalItem, setLocalItem, requestLocation, label]);

    const sortedSessions = useMemo(() => {
        return [...sessions].sort((a, b) => b.createdAt - a.createdAt);
    }, [sessions]);

    const handleCreate = async () => {
        if (!label.trim()) return;
        await onCreate({ label: label.trim(), room: room.trim() || undefined, ttlSeconds });
        setLabel("");
    };

    const copyLink = async (text: string, id: string) => {
        try {
            setCopying(id);
            await navigator.clipboard.writeText(text);
        } finally {
            setCopying(null);
        }
    };

    const togglePreview = (id: string) => {
        setPreviewId((current) => (current === id ? null : id));
    };

    return (
        <>
            <style jsx>{Obscurestyles}</style>
            <article className="camera-panel">

                <div className="obscure__camera-view">
                    <UiForm
                        // size="md"
                        title={<div className='d-flex justify-between s-9'>
                            <div>
                                Create camera link
                            </div>
                            <div>

                                <UiIcon icon="fa-camera-retro" />
                            </div>
                        </div>
                        }
                        fields={cameraFormFields}
                        onChange={handleCameraFormChange}
                        onSubmit={handleCreate}
                        submitText="Create link"
                        loading={creating}
                        disabled={!label.trim()}
                    />

                    <div className="obscure__camera-grid">
                        {sortedSessions.length === 0 && (
                            <div className="obscure__empty">
                                No camera links yet. Create one and share the guest link to start streaming.
                            </div>
                        )}
                        {sortedSessions.map((session) => {
                            const isRevoked = session.status === "revoked";
                            const showPreview = !isRevoked && previewId === session.id;
                            return (
                                <div
                                    key={session.id}
                                    className={classNames({
                                        "obscure__camera-card": true,
                                        "is-revoked": isRevoked,
                                    })}
                                >
                                    <div className="obscure__camera-head">
                                        <div>
                                            <span className="obscure__camera-label">{session.label}</span>
                                            <span className="obscure__camera-meta">Room · {session.room}</span>
                                        </div>
                                        <span className={classNames({
                                            "obscure__camera-status": true,
                                            [`status-${session.status}`]: true,
                                        })}>
                                            {statusLabel[session.status]}
                                        </span>
                                    </div>
                                    <div className="obscure__camera-links">
                                        <div>
                                            <p className="obscure__camera-link-label">Guest link</p>
                                            <p className="obscure__camera-link">{session.guestUrl}</p>
                                        </div>
                                        <UiButton
                                            variant="ghost"
                                            onClick={() => copyLink(session.guestUrl, session.id)}
                                            aria-busy={copying === session.id}
                                        >
                                            Copy
                                        </UiButton>
                                    </div>
                                    <div className="obscure__camera-links">
                                        <div>
                                            <p className="obscure__camera-link-label">Viewer link</p>
                                            <p className="obscure__camera-link">{session.viewUrl}</p>
                                        </div>
                                        <UiButton
                                            variant="ghost"
                                            onClick={() => copyLink(session.viewUrl, `${session.id}-view`)}
                                            aria-busy={copying === `${session.id}-view`}
                                        >
                                            Copy
                                        </UiButton>
                                        <UiButton
                                            variant="ghost"
                                            onClick={() => togglePreview(session.id)}
                                            disabled={!session.viewUrl || isRevoked}
                                        >
                                            {showPreview ? "Hide preview" : "Preview"}
                                        </UiButton>
                                    </div>
                                    {showPreview && session.viewUrl && (
                                        <div className="obscure__camera-preview">
                                            <iframe
                                                title={`Camera preview – ${session.label}`}
                                                src={session.viewUrl}
                                                allow="autoplay; camera; microphone; fullscreen"
                                                allowFullScreen
                                            />
                                        </div>
                                    )}
                                    <div className="obscure__camera-foot">
                                        <span>
                                            Created {formatTime(session.createdAt)} · Expires {formatTime(session.expiresAt)}
                                        </span>
                                        <div className="obscure__camera-actions">
                                            <UiButton
                                                variant="ghost"
                                                onClick={() => onRevoke(session.id)}
                                                disabled={isRevoked}
                                            >
                                                Revoke
                                            </UiButton>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </article   >
        </>
    );
};

export default CameraPanel;
