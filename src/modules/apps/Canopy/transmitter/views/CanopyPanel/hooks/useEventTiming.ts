import { useMemo } from "react";
import { dateFormat, timeUntil } from "@webstack/helpers/userExperienceFormats";
import { EventRow } from "@Canopy/hooks/useCanopy";

export const useEventTiming = (current: EventRow | null, nowTick: number) => {
    const deviceTz = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        } catch {
            return "";
        }
    }, []);

    const tzDiffLabel = useMemo(() => {
        if (!current?.timezone) return "—";
        const when = current?.starts_at ? new Date(current.starts_at) : new Date();
        if (!(when instanceof Date) || isNaN(when.getTime())) return "—";
        try {
            const eventLocalStr = when.toLocaleString("en-US", { timeZone: current.timezone });
            const eventAsDevice = new Date(eventLocalStr);
            const diffMin = Math.round((eventAsDevice.getTime() - when.getTime()) / 60000);
            const sign = diffMin >= 0 ? "+" : "-";
            const abs = Math.abs(diffMin);
            const h = Math.floor(abs / 60);
            const m = abs % 60;
            const delta = `${sign}${h}h${m ? ` ${m}m` : ""}`;
            const dev = deviceTz || "device";
            return `${delta} vs ${dev}`;
        } catch {
            return "—";
        }
    }, [current?.timezone, current?.starts_at, deviceTz]);

    const formattedStarts = useMemo(
        () => (current?.starts_at ? dateFormat(current.starts_at, { time: true }) : "—"),
        [current?.starts_at]
    );
    const formattedEnds = useMemo(
        () => (current?.ends_at ? dateFormat(current.ends_at, { time: true }) : "—"),
        [current?.ends_at]
    );
    const untilLabel = useMemo(
        () => (current?.starts_at ? timeUntil(current.starts_at, { largest: 2, style: "short" }) : "—"),
        [current?.starts_at, nowTick]
    );

    const eventTableData = useMemo(() => {
        if (!current) return [] as [string, any][];
        const list: [string, any][] = [];
        list.push(["Starts at", formattedStarts]);
        list.push(["Ends at", formattedEnds]);
        list.push(["Timezone", current.timezone || "—"]);
        if (deviceTz) list.push(["Device TZ", deviceTz]);
        list.push(["Time until race", untilLabel]);
        list.push(["Time difference", tzDiffLabel]);
        list.push(["Live", current.is_live ? "Yes" : "No"]);
        if ((current as any)?.user_id) list.push(["Owner", (current as any).user_id]);
        return list;
    }, [current, formattedStarts, formattedEnds, deviceTz, untilLabel, tzDiffLabel]);

    return { deviceTz, tzDiffLabel, formattedStarts, formattedEnds, untilLabel, eventTableData };
};
