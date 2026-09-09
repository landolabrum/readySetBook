import { EventRow } from "@Canopy/hooks/useCanopy";

export type CanopyPanelProps = {
    current: EventRow | null;
    events: EventRow[] | { data: EventRow[] } | null | undefined;
    setCurrent: (e: EventRow | null) => void;
    onDelete: (id?: string) => void;
    deletingId?: string;
    onRefresh?: () => void;
};
