import React, { useEffect, useMemo, useState } from "react";
import styles from "./AdminFlipper.scss";
import { getService } from "@webstack/common";
import AdaptGrid from "@webstack/components/Containers/AdaptGrid/AdaptGrid";
import AdapTable from "@webstack/components/AdapTable/views/AdapTable";
import UiCard from "@webstack/components/UiCard/UiCard";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiForm from "@webstack/components/UiForm/controller/UiForm";
import UiSelect from "@webstack/components/UiForm/components/UiSelect/UiSelect";
import ToggleSwitch from "@webstack/components/UiForm/components/UiToggle/UiToggle";
import useLocalStorage from "@webstack/hooks/storage/useLocalStorage";
import useSessionStorage from "@webstack/hooks/storage/useSessionStorage";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import { useNotification } from "@webstack/components/Notification/Notification";
import IAdminService, {
    IFlipperActionResponse,
    IFlipperSavedSub,
    IFlipperStatus,
} from "~/src/core/services/AdminService/IAdminService";
import AdminService from "~/src/core/services/AdminService/AdminService";
import { IFormField } from "@webstack/components/UiForm/models/IFormModel";

const IR_LS_KEY = "flipper:last:ir";
const SUB_LS_KEY = "flipper:last:sub";
const SUB_LIST_KEY = "flipper:saved:sub:list";
const STATUS_SS_KEY = "flipper:status";

const presets = [
    { label: "TV Power Toggle (generic)", value: "ir_tv_power" },
    { label: "AC Toggle (generic)", value: "ir_ac_toggle" },
    { label: "Garage SubGHz (sample)", value: "sub_433_sample" },
];

const AdminFlipper: React.FC = () => {
    const resolvedService = useMemo(() => {
        try {
            return getService<IAdminService>("IAdminService");
        } catch {
            return new AdminService();
        }
    }, []);

    const [status, setStatus] = useState<IFlipperStatus | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [fileField, setFileField] = useState<IFormField[]>([
        { name: "file", label: "File", type: "file", multiple: false },
    ]);
    const [irFields, setIrFields] = useState<IFormField[]>([
        { name: "signal", label: "IR signal", type: "textarea", value: "" },
        { name: "repeat", label: "Repeat", type: "number", value: 1, min: 1, max: 10 },
    ]);
    const [subFields, setSubFields] = useState<IFormField[]>([
        { name: "payload", label: "SubGHz payload", type: "textarea", value: "" },
        { name: "repeat", label: "Repeat", type: "number", value: 1, min: 1, max: 10 },
    ]);
    const [rememberPayloads, setRememberPayloads] = useState<boolean>(true);
    const [savedSub, setSavedSub] = useState<IFlipperSavedSub | null>(null);
    const [savedList, setSavedList] = useState<IFlipperSavedSub[]>([]);

    const { setLocalItem, getLocalItem } = useLocalStorage();
    const session = useSessionStorage();
    const { openModal, closeModal } = useModal();
    const [, setNotification] = useNotification();

    const normalizeSaved = (list: any[]): IFlipperSavedSub[] =>
        (Array.isArray(list) ? list : [])
            .map((item) => ({
                payload: item?.payload ?? "",
                repeat: Number(item?.repeat) || 1,
                savedAt: item?.savedAt ? Number(item?.savedAt) : undefined,
                name: item?.name,
                source: item?.source,
                path: item?.path,
                size: item?.size ? Number(item?.size) : undefined,
            }))
            .filter((item) => item.payload);

    const mergeSaved = (primary: IFlipperSavedSub[], secondary: IFlipperSavedSub[]) => {
        const byPayload = new Map<string, IFlipperSavedSub>();
        [...primary, ...secondary].forEach((item) => {
            if (!item?.payload) return;
            const existing = byPayload.get(item.payload);
            const newer = !existing || (item.savedAt || 0) >= (existing.savedAt || 0);
            if (newer) byPayload.set(item.payload, item);
        });
        return Array.from(byPayload.values());
    };

    const applySavedList = (list: IFlipperSavedSub[]) => {
        const cleaned = normalizeSaved(list).slice(0, 50);
        setSavedList(cleaned);
        if (cleaned[0]) setSavedSub(cleaned[0]);
        if (cleaned.length) {
            setLocalItem(SUB_LIST_KEY, cleaned);
            if (!getLocalItem(SUB_LS_KEY)) setLocalItem(SUB_LS_KEY, cleaned[0]);
        }
    };

    const fetchSavedFromApi = async () => {
        try {
            const res = await resolvedService.getFlipperSavedSubGhz();
            const serverList = normalizeSaved(res?.items || []);
            if (serverList.length) {
                const merged = mergeSaved(serverList, savedList);
                applySavedList(merged);
            }
        } catch {
            // silent fallback to local storage
        }
    };

    const ingestFromDevice = async () => {
        try {
            const res = await resolvedService.ingestFlipperSavedSubGhz();
            const serverList = normalizeSaved(res?.items || []);
            if (serverList.length) {
                const merged = mergeSaved(serverList, savedList);
                applySavedList(merged);
            }
        } catch {
            // ignore ingest failures
        }
    };

    useEffect(() => {
        const savedIr = getLocalItem(IR_LS_KEY);
        const savedSubLocal = getLocalItem(SUB_LS_KEY);
        const savedSubList = (getLocalItem(SUB_LIST_KEY) as any[]) || [];
        const savedStatus = session.getSessionItem(STATUS_SS_KEY)?.value as IFlipperStatus;
        if (savedIr) setIrFields((prev) => prev.map((f) => (f.name === "signal" ? { ...f, value: savedIr } : f)));
        if (savedSubLocal) {
            const asObj = typeof savedSubLocal === "string"
                ? { payload: savedSubLocal, repeat: 1 }
                : { payload: savedSubLocal?.payload, repeat: Number(savedSubLocal?.repeat) || 1, savedAt: savedSubLocal?.savedAt };
            setSavedSub(asObj);
            setSubFields((prev) => prev.map((f) => (f.name === "payload" ? { ...f, value: asObj.payload } : f)));
            setSubFields((prev) => prev.map((f) => (f.name === "repeat" ? { ...f, value: asObj.repeat } : f)));
        }
        if (Array.isArray(savedSubList) && savedSubList.length) {
            const cleaned = normalizeSaved(savedSubList);
            setSavedList(cleaned);
            if (!savedSub && cleaned[0]) setSavedSub(cleaned[0]);
        } else if (savedSubLocal) {
            const asObj = typeof savedSubLocal === "string"
                ? { payload: savedSubLocal, repeat: 1 }
                : { payload: savedSubLocal?.payload, repeat: Number(savedSubLocal?.repeat) || 1, savedAt: savedSubLocal?.savedAt };
            if (asObj.payload) {
                setSavedList([asObj]);
                setLocalItem(SUB_LIST_KEY, [asObj]);
            }
        }
        if (savedStatus) setStatus(savedStatus);
        fetchSavedFromApi();
        ingestFromDevice();
    }, []);

    const notify = (message: string, type: "success" | "error" = "success") => {
        const persistence = type === "success" ? 2200 : 3200;
        setNotification({
            active: true,
            children: message,
            persistence,
            transparent: true,
            dismissable: true,
        });
    };

    const handleStatus = async () => {
        setBusy("status");
        try {
            const data = await resolvedService.getFlipperStatus();
            setStatus(data);
            session.setSessionItem(STATUS_SS_KEY, { value: data });
            notify(data.connected ? "Flipper connected" : "Flipper in dry-run mode");
        } catch (error: any) {
            notify(error?.message || "Failed to fetch status", "error");
        } finally {
            setBusy(null);
        }
    };

    const handleVibrate = async () => {
        setBusy("vibrate");
        try {
            const res = await resolvedService.flipperVibrate({ duration: 0.4 });
            notify(res?.detail || "Vibration sent");
        } catch (error: any) {
            notify(error?.message || "Vibrate failed", "error");
        } finally {
            setBusy(null);
        }
    };

    const handleInfrared = async () => {
        setBusy("infrared");
        try {
            const signal = String(irFields.find((f) => f.name === "signal")?.value || "");
            const repeat = Number(irFields.find((f) => f.name === "repeat")?.value || 1);
            const res = await resolvedService.flipperInfrared({ signal, repeat });
            if (rememberPayloads) setLocalItem(IR_LS_KEY, signal);
            notify(res?.detail || "IR sent");
        } catch (error: any) {
            notify(error?.message || "IR send failed", "error");
        } finally {
            setBusy(null);
        }
    };

    const handleSubGhz = async () => {
        setBusy("subghz");
        try {
            const payload = String(subFields.find((f) => f.name === "payload")?.value || "");
            const repeat = Number(subFields.find((f) => f.name === "repeat")?.value || 1);
            const res = await resolvedService.flipperSubGhz({ payload, repeat, remember: rememberPayloads });
            if (rememberPayloads && payload) {
                const entry = { payload, repeat, savedAt: Date.now() };
                const nextList = [entry, ...savedList.filter((item) => item.payload !== payload)].slice(0, 20);
                setLocalItem(SUB_LS_KEY, entry);
                setLocalItem(SUB_LIST_KEY, nextList);
                setSavedSub(entry);
                setSavedList(nextList);
            }
            notify(res?.detail || "SubGHz sent");
            fetchSavedFromApi();
        } catch (error: any) {
            notify(error?.message || "SubGHz send failed", "error");
        } finally {
            setBusy(null);
        }
    };

    const loadSavedSub = (entry: { payload: string; repeat: number }) => {
        setSubFields((prev) => prev.map((f) => (f.name === "payload" ? { ...f, value: entry.payload } : f)));
        setSubFields((prev) => prev.map((f) => (f.name === "repeat" ? { ...f, value: entry.repeat } : f)));
        setSavedSub(entry);
        notify("Loaded saved SubGHz payload");
    };

    const handlePushFile = async () => {
        setBusy("file");
        try {
            const file = fileField.find((f) => f.name === "file")?.value as File | undefined;
            if (!file) throw new Error("Select a file first");
            const res = await resolvedService.flipperPushFile(file);
            notify(res?.detail || "File pushed");
            setFileField((prev) => prev.map((f) => (f.name === "file" ? { ...f, value: undefined } : f)));
        } catch (error: any) {
            notify(error?.message || "File push failed", "error");
        } finally {
            setBusy(null);
        }
    };

    const confirmReboot = () => {
        openModal({
            title: "Reboot Flipper?",
            children: "Reboot now? This interrupts any running scripts.",
            confirm: {
                statements: [
                    {
                        label: "Reboot",
                        onClick: async () => {
                            setBusy("reboot");
                            try {
                                const res = await resolvedService.flipperReboot();
                                notify(res?.detail || "Reboot requested");
                            } catch (error: any) {
                                notify(error?.message || "Reboot failed", "error");
                            } finally {
                                setBusy(null);
                                closeModal();
                            }
                        },
                    },
                    { label: "Cancel", onClick: closeModal },
                ],
            },
        });
    };

    const onFieldChange = (
        setter: React.Dispatch<React.SetStateAction<IFormField[]>>,
    ) =>
        (e: any) => {
            const { name, value, files } = e.target || {};
            setter((prev) =>
                prev.map((f) => {
                    if (f.name !== name) return f;
                    if (files && files[0]) return { ...f, value: files[0] };
                    return { ...f, value };
                }),
            );
        };

    const applyPreset = (value?: string) => {
        if (!value) return;
        if (value.startsWith("ir_")) {
            setIrFields((prev) => prev.map((f) => (f.name === "signal" ? { ...f, value } : f)));
        }
        if (value.startsWith("sub_")) {
            setSubFields((prev) => prev.map((f) => (f.name === "payload" ? { ...f, value } : f)));
        }
    };

    const renderStatus = () => (
        <UiCard className="admin-flipper__card" header={{ title: "Status" }}>
            <div className="admin-flipper__status">
                <div className="admin-flipper__status-row">
                    <span>Connected</span>
                    <strong>{status?.connected ? "Yes" : "No"}</strong>
                </div>
                <div className="admin-flipper__status-row">
                    <span>Mode</span>
                    <strong>{status?.mode || "unknown"}</strong>
                </div>
                <UiButton busy={busy === "status"} onClick={handleStatus} variant="dark">
                    Refresh
                </UiButton>
            </div>
        </UiCard>
    );

    const renderActions = () => (
        <UiCard className="admin-flipper__card" header={{ title: "Quick actions" }}>
            <div className="admin-flipper__actions">
                <UiButton busy={busy === "vibrate"} onClick={handleVibrate} variant="dark">
                    Vibrate
                </UiButton>
                <UiButton busy={busy === "reboot"} onClick={confirmReboot} variant="light">
                    Reboot
                </UiButton>
            </div>
        </UiCard>
    );

    const renderIR = () => (
        <UiCard className="admin-flipper__card" header={{ title: "Infrared" }}>
            <UiForm
                fields={irFields}
                onChange={onFieldChange(setIrFields)}
                onSubmit={handleInfrared}
                submitText="Send IR"
                submitIcon="fa-paper-plane"
                loading={busy === "infrared"}
            />
        </UiCard>
    );

    const renderSubGhz = () => (
        <UiCard className="admin-flipper__card" header={{ title: "SubGHz" }}>
            <UiForm
                fields={subFields}
                onChange={onFieldChange(setSubFields)}
                onSubmit={handleSubGhz}
                submitText="Send SubGHz"
                submitIcon="fa-wave-square"
                loading={busy === "subghz"}
            />
        </UiCard>
    );

    const renderSavedSub = () => (
        <UiCard className="admin-flipper__card" header={{ title: "Saved SubGHz" }}>
            <AdapTable
                data={savedList.map((row, idx) => ({ ...row, id: idx, actions: "load" }))}
                variant={["mini", "vertical"]}
                options={{
                    // hide: ["footer"],
                    hideColumns: ["id"],
                    placeholder: "No saved payloads yet",
                    renderCell: (key, item) => {
                        if (key === "name") return item.name || "";
                        if (key === "source") return item.source || "";
                        if (key === "payload") {
                            const label = item.name || item.payload;
                            return <span className="admin-flipper__payload">{label}</span>;
                        }
                        if (key === "repeat") return item.repeat;
                        if (key === "savedAt") {
                            return item.savedAt ? new Date(item.savedAt).toLocaleString() : "";
                        }
                        if (key === "actions") {
                            return (
                                <UiButton size="sm" variant="light" onClick={() => loadSavedSub(item)}>
                                    Load
                                </UiButton>
                            );
                        }
                        return item[key];
                    },
                }}
            />
        </UiCard>
    );

    const renderFile = () => (
        <UiCard className="admin-flipper__card" header={{ title: "File push" }}>
            <UiForm
                fields={fileField}
                onChange={onFieldChange(setFileField)}
                onSubmit={handlePushFile}
                submitText="Push"
                submitIcon="fa-upload"
                loading={busy === "file"}
            />
        </UiCard>
    );

    return (
        <div className="admin-flipper">
            <style jsx>{styles}</style>
            <div className="admin-flipper__header">
                <div className="admin-flipper__title">Flipper Zero</div>
                <div className="admin-flipper__header-controls">
                    <UiSelect
                        title="Presets"
                        options={presets}
                        onSelect={(opt: any) => applyPreset(opt?.value)}
                        variant="light"
                        clearable
                    />
                    <div className="admin-flipper__toggle">
                        <span>Remember payloads</span>
                        <ToggleSwitch
                            name="remember"
                            value={rememberPayloads}
                            onChange={(e) => setRememberPayloads(Boolean(e?.target?.value))}
                        />
                    </div>
                </div>
            </div>
            <AdaptGrid xs={6} md={4} lg={3} gap={20}>
                {renderStatus()}
                {renderActions()}
                {renderIR()}
                {renderSubGhz()}
                {renderSavedSub()}
                {renderFile()}
            </AdaptGrid>
        </div>
    );
};

export default AdminFlipper;
