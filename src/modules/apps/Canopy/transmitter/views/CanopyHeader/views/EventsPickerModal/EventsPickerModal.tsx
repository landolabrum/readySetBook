import React, { useMemo } from "react";
import AdapTable from "@webstack/components/AdapTable/views/AdapTable";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import { EventRow } from "@Canopy/hooks/useCanopy";
import styles from "./EventsPickerModal.scss";

export type EventsPickerModalProps = {
    events: EventRow[];
    onSelect: (event: EventRow) => void;
    onCreateEvent?: () => void;
};

const EventsPickerModal: React.FC<EventsPickerModalProps> = ({ events, onSelect, onCreateEvent }) => {
    const rows = useMemo(
        () =>
            [...events]
                .sort((a, b) => new Date(b.starts_at ?? 0).getTime() - new Date(a.starts_at ?? 0).getTime())
                .map((e) => ({
                    id: e.id,
                    Event: e.name,
                    Live: e.is_live ? "true" : "false",
                    "Starts at": e.starts_at ? new Date(e.starts_at).toLocaleString() : "—",
                })),
        [events]
    );

    const handleRowClick = (row: { id: string | number }) => {
        const match = events.find((e) => String(e.id) === String(row.id));
        if (match) onSelect(match);
    };

    return (
        <div className="events-picker-modal">
            <style jsx>{styles}</style>

            {rows.length ? (
                <AdapTable
                    variant="mini"
                    data={rows}
                    options={{ hideColumns: ["id"] }}
                    onRowClick={handleRowClick}
                />
            ) : (
                <p className="events-picker-modal__empty">No events yet — create one to get started.</p>
            )}

            {onCreateEvent && (
                <UiButton onClick={onCreateEvent} variant="link" traits={{ afterIcon: "fas-plus" }}>
                    Create event
                </UiButton>
            )}
        </div>
    );
};

export default EventsPickerModal;
