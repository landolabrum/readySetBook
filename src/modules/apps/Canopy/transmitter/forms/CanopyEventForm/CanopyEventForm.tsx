import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getService } from "@webstack/common";
import UiForm from "@webstack/components/UiForm/controller/UiForm";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import { IFormField } from "@webstack/components/UiForm/models/IFormModel";
import { useNotification } from "@webstack/components/Notification/Notification";
import IDataBaseService from "~/src/core/services/DataBaseService/IDataBaseService";
import { useUser } from "~/src/core/authentication/hooks/useUser";
import { EventRow } from "@Canopy/hooks/useCanopy";
import { toISO, toLocalInputValue } from "@/utils/datetime";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";

type Props = {
    event?: EventRow | null;
    compact?: boolean;
    onCreated?: (newEventId?: string, row?: EventRow) => void;
    onDone?: (updated?: Partial<EventRow>) => void;
    onRefresh?: () => Promise<void> | void;
};

const TZ_OPTS = [
    "UTC",
    "America/Denver",
    "America/Los_Angeles",
    "America/Chicago",
    "America/New_York",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Australia/Sydney",
].map((z) => ({ label: z, value: z }));

const TABLE_EVENT = "livestream_event";

const toIntOrFallback = (v: any, fallback: number) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Helper to get default start time (now)
const getDefaultStartsAt = () => new Date().toISOString().slice(0, 16);
// Helper to get default end time (now + 1 hour)
const getDefaultEndsAt = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

const CanopyEventForm: React.FC<Props> = ({ event, compact, onCreated, onDone, onRefresh }) => {
    const isEdit = !!event?.id;
    const db = getService<IDataBaseService>("IDataBaseService");
    const router = useRouter();
    const user = useUser();
    const [, setNotification] = useNotification();

    const stripeId = useMemo(() => (user?.id != null ? String(user.id) : ""), [user]);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdId, setCreatedId] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [values, setValues] = useState<Record<string, any>>({
        name: event?.name ?? "",
        // Default starts_at to now for new events, or use existing value for edits
        starts_at: isEdit ? toLocalInputValue(event?.starts_at ?? null) : getDefaultStartsAt(),
        // Default ends_at to now + 1h for new events, or use existing value for edits
        ends_at: isEdit ? toLocalInputValue(event?.ends_at ?? null) : getDefaultEndsAt(),
        timezone: event?.timezone ?? "America/Denver",
        is_live: !!event?.is_live,
        address: (event as any)?.address ?? null,
        lat: (event as any)?.lat ?? null,
        lng: (event as any)?.lng ?? null,
        css_url: (event as any)?.css_url ?? "",
        css_text: (event as any)?.css_text ?? "",
        design_width:
            event?.design_width ?? (event as any)?.designWidth ?? (event as any)?.design_w ?? 1920,
        design_height:
            event?.design_height ?? (event as any)?.designHeight ?? (event as any)?.design_h ?? 1080,
    });

    // Basic fields - only event name
    const basicFields: IFormField[] = useMemo(() => [
        { name: "name", label: "Event name", type: "text", required: true, value: values.name, constraints: { min: 3 } },
    ], [values.name]);

    // Advanced fields - everything else
    const advancedFields: IFormField[] = useMemo(() => {
        const base: IFormField[] = [
            { name: "starts_at", label: "Starts at", type: "datetime-local", required: true, value: values.starts_at, width: "50%" },
            { name: "ends_at", label: "Ends at", type: "datetime-local", value: values.ends_at, width: "50%" },
            {
                name: "start_now",
                label: "Set Start = Now",
                variant: "link",
                type: "button",
                onClick: () => setValues((v) => ({ ...v, starts_at: getDefaultStartsAt() })),
            },
            {
                name: "end_plus_1h",
                variant: "link",
                label: "Ends +1H",
                type: "button",
                onClick: () => setValues((v) => ({ ...v, ends_at: getDefaultEndsAt() })),
            },
            { name: "timezone", label: "Timezone", type: "select", options: TZ_OPTS, value: values.timezone, input: true },
            { name: "address", label: "Location (optional)", type: "address", value: values.address },
            values.lat != null
                ? { name: "lat", label: "Latitude", readonly: true, value: String(values.lat) }
                : ({} as any),
            values.lng != null
                ? { name: "lng", label: "Longitude", readonly: true, value: String(values.lng) }
                : ({} as any),
            { name: "is_live", label: "Is live?", type: "checkbox", value: !!values.is_live },
            {
                name: "design_width",
                label: "Design width (px)",
                type: "number",
                value: values.design_width,
                min: 1,
                step: 1,
                width: "50%",
            },
            {
                name: "design_height",
                label: "Design height (px)",
                type: "number",
                value: values.design_height,
                min: 1,
                step: 1,
                width: "50%",
            },
            {
                name: "css_url",
                label: "CSS url",
                type: "text",
                placeholder: "https://example.com/overlay.css",
                value: values.css_url,
            },
            {
                name: "css_text",
                label: "CSS (optional)",
                type: "textarea",
                placeholder: ":root {\n  --canopy-accent: #ff5500;\n}\n",
                value: values.css_text,
            },
        ];

        return base.filter(Boolean) as IFormField[];
    }, [values]);

    const handleChange = (e: any) => {
        const { name, value, target } = e?.target ? e.target : e ?? {};
        const fieldName = name;

        if (!fieldName) return;

        if (fieldName === "address") {
            setValues((v) => ({
                ...v,
                address: value ?? null,
                lat: value?.lat ?? null,
                lng: value?.lng ?? null,
            }));
            return;
        }

        if (fieldName === "starts_at") {
            setValues((v) => {
                const next: any = { ...v, starts_at: value };
                if (!v.ends_at && value) {
                    const start = new Date(value);
                    if (!isNaN(+start)) {
                        const plus1h = new Date(start.getTime() + 60 * 60 * 1000);
                        next.ends_at = plus1h.toISOString().slice(0, 16);
                    }
                }
                return next;
            });
            return;
        }

        if (target?.type === "checkbox") {
            setValues((v) => ({ ...v, [fieldName]: !!target.checked }));
            return;
        }

        if (target?.type === "number") {
            setValues((v) => ({ ...v, [fieldName]: target.value === "" ? "" : Number(target.value) }));
            return;
        }

        setValues((v) => ({ ...v, [fieldName]: value }));
    };

    const refreshEvents = async () => {
        try {
            await onRefresh?.();
        } catch {
            // no-op
        }
    };

    const handleSubmit = async () => {
        setBusy(true);
        setError(null);
        setCreatedId(null);

        try {
            const payload = {
                name: values.name?.trim(),
                starts_at: toISO(values.starts_at),
                ends_at: toISO(values.ends_at),
                timezone: values.timezone || null,
                is_live: !!values.is_live,
                lat: values.lat ?? null,
                lng: values.lng ?? null,
                css_url: values.css_url?.trim() || null,
                css_text: values.css_text?.trim() || null,
                design_width: toIntOrFallback(values.design_width, 1920),
                design_height: toIntOrFallback(values.design_height, 1080),
            } as Partial<EventRow> & { name?: string | null; starts_at?: string | null } & Record<string, any>;

            if (!payload.name || !payload.starts_at) {
                throw new Error("Name and start time are required.");
            }

            // Multiple events can be live simultaneously — no need to
            // turn off other events when enabling is_live.

            if (isEdit && event?.id) {
                const res = await db.updateData({
                    tableName: TABLE_EVENT,
                    set: payload,
                    where: { id: event.id },
                });

                const updated: EventRow = (Array.isArray((res as any)?.data)
                    ? (res as any).data[0]
                    : (res as any)?.data) || { ...event, ...payload };

                setNotification({
                    active: true,
                    dismissable: true,
                    persistence: 3500,
                    list: [
                        {
                            label: "Event updated",
                            message: `“${updated.name}” • ${updated.timezone ?? "—"} • live: ${updated.is_live ? "Yes" : "No"}`,
                        },
                    ],
                });

                onDone?.(updated);
                await refreshEvents();
            } else {
                if (!stripeId) throw new Error("Missing user id (stripe_id). Please sign in.");

                const insertPayload = {
                    ...payload,
                    stripe_id: stripeId,
                } as any;

                const res = await db.insertData({
                    tableName: TABLE_EVENT,
                    values: [insertPayload],
                } as any);

                const inserted =
                    (Array.isArray((res as any)?.data) ? (res as any).data[0] : (res as any)?.data) || null;

                const id = inserted?.id ?? inserted?.event_id ?? null;
                if (!id) throw new Error("Event created but no id returned.");

                setCreatedId(String(id));

                try {
                    await router.replace({ pathname: router.pathname, query: { ...router.query, event: id } }, undefined, {
                        shallow: true,
                    });
                } catch {
                    /* no-op */
                }

                onCreated?.(String(id), inserted as EventRow);

                setValues((v) => ({ ...v, name: "", starts_at: "", ends_at: "" }));

                if (onRefresh) await refreshEvents();
                else router.reload();
            }
        } catch (e: any) {
            setError(e?.message || "Failed to save event");
            setNotification({
                active: true,
                dismissable: true,
                persistence: 6000,
                apiError: {
                    message: "Failed to save event",
                    status: 0,
                    detail: e?.message ?? e,
                    error: true,
                },
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {createdId && !isEdit && (
                <div style={{ marginBottom: 8 }}>
                    <small style={{ opacity: 0.7 }}>created: {createdId}</small>
                </div>
            )}

            {error && <div style={{ color: "var(--red-60)", marginBottom: 8 }}>{error}</div>}

            <UiForm
                title={
                    <div className="d-flex s-w-100 justify-between align-center gray-10">
                        <div>{isEdit ? "Edit Event" : "Add Event"}</div>
                        <div
                            onClick={(e) => { e.stopPropagation(); setShowAdvanced(!showAdvanced); }}
                            style={{ cursor: "pointer", padding: "4px" }}
                            title={showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
                        >
                            <UiIcon
                                alt={showAdvanced ? "Hide advanced settings" : "Show advanced settings"}

                                icon={showAdvanced ? "fa-eye-slash" : "fa-gear"} />
                        </div>
                    </div>
                }
                fields={basicFields}
                onChange={handleChange}

                loading={busy}
            />

            {showAdvanced && (
                <UiForm
                    fields={advancedFields}
                    onChange={handleChange}
                />
            )}
            <UiButton
                variant="primary"
                onClick={handleSubmit}
                traits={{ afterIcon: isEdit ? undefined : "fas-plus" }}
            >
                {isEdit ? "Save changes" : "Add event"}
            </UiButton>
        </>
    );
};

export default CanopyEventForm;