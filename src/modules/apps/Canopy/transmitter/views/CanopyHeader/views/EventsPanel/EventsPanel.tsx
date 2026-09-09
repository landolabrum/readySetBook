import React from "react";
import UiSelect from "@webstack/components/UiForm/components/UiSelect/UiSelect";
import AdapTable from "@webstack/components/AdapTable/views/AdapTable";
import { EventRow } from "@Canopy/hooks/useCanopy";
import styles from "./EventsPanel.scss";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import UiRadioLayout from "@webstack/layouts/UiRadioLayout/controller/UiRadioLayout";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiCollapse from "@webstack/components/UiCollapse/UiCollapse";
import { IFormField } from "@webstack/components/UiForm/models/IFormModel";

import useWindow from "@webstack/hooks/window/useWindow";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import AdaptTableCell from "@webstack/components/AdapTable/components/AdaptTableContent/components/AdaptTableCell/AdaptTableCell";

export type EventsPanelProps = {
    current: EventRow | null;
    currentIsLive: boolean;
    options: IFormField[];
    onSelect: (opt: { value?: string } | string) => void;
    eventTableData: [string, any][];
    title?: string | React.ReactElement;
    deletingId?: string;
    copyingId?: string;
    onShareLive?: () => void;
    handleToggleLive?: () => void;
    onCreateEvent?: () => void;
    onEditEvent?: () => void;
    onCopyEvent?: () => void;
    onRefresh?: () => void;
    onDelete: (id: string) => void;
};

const EventsPanel: React.FC<EventsPanelProps> = ({ current, currentIsLive, options, onSelect, eventTableData, deletingId, copyingId, handleToggleLive, onCreateEvent, onEditEvent, onCopyEvent, onRefresh, onDelete, title }) => {
    const isDeleting = !!(deletingId && current && String(deletingId) === String(current.id));
    const isCopying = !!(copyingId && current && String(copyingId) === String(current.id));
    const {width} = useWindow();
    const { isModalOpen } = useModal();

    return (
        <>
            <style jsx>{styles}</style>

            <div className="events-panel">

                <UiRadioLayout
                    title={
                        <AdaptTableCell cell="icon-label" data={
                            {
                                label: title,
                                icon: "fa-calendar-days"
                            }
                        } />
                    }
                    defaultValue="list"
                    collapsed={width>1100}
                    layout={{ navigationPosition: "left", orientation: "vertical" }}
                    views={[
                        {
                            id: "details",
                            header: current?.name,
                            content: (
                                <div >
                                    <UiCollapse label={`${current?.name || "select an event"} details`} open={false}>
                                        <AdapTable options={{ hide: "header" }} variant="mini" data={eventTableData} />
                                    </UiCollapse>
                                </div>
                            ),
                        },
                        {
                            id: "list",
                            navigation: { icon: "fa-list", alt: "events list" },
                            content: (<div style={{minWidth: "350px"}}>

                                <UiSelect
                                    // openDirection="left"
                                    label={
                                        !current && options?.length > 0 ? "Select an event" : current?.name || "No events available"
                                    }
                                    // openState={!current && "open" || undefined}
                                    value={current ? String(current.id) : !options?.length ? "server down" : "-- Select Event --"}
                                    options={options}
                                    overlay={isModalOpen ? undefined : { zIndex: 100 }}
                                    traits={{
                                        // error: ,
                                        beforeIcon: {
                                            icon: "fa-broadcast-tower",
                                            color: currentIsLive ? "var(--green-10)" : "var(--gray-60)",
                                        },
                                    }}
                                    onSelect={onSelect}
                                    search
                                />
                            </div>
                            ),
                        },
                        {
                            id: "create",
                            navigation: { icon: "fas-plus", alt: "create" },
                            content: (
                                <UiButton onClick={onCreateEvent} variant="link" traits={{ afterIcon: "fas-plus" }}>
                                    Create event
                                </UiButton>
                            ),
                            kind: "control",
                            navContent: <UiIcon icon="fas-plus" alt="Create event" onClick={onCreateEvent} />,
                        },
                        // Edit, delete, duplicate only appear when an event is selected
                        ...(current ? [
                            {
                                id: "edit",
                                navigation: { icon: "fa-pen-to-square", alt: "edit" },
                                content: (
                                    <UiButton onClick={onEditEvent} variant="link">
                                        Edit current
                                    </UiButton>
                                ),
                                kind: "control" as const,
                                navContent: <UiIcon icon="fa-pen-to-square" alt="Edit event" onClick={onEditEvent} />,
                            },
                            {
                                id: "delete",
                                navigation: { icon: isDeleting ? "fa-spinner fa-spin" : "fa-trash-can", alt: "delete" },
                                content: (
                                    <UiButton
                                        onClick={() => onDelete(current.id)}
                                        variant="link"
                                        traits={{ afterIcon: isDeleting ? "fa-spinner fa-spin" : "fa-trash-can" }}
                                    >
                                        Delete event
                                    </UiButton>
                                ),
                                kind: "control" as const,
                                navContent: (
                                    <UiIcon
                                        icon={isDeleting ? "fa-spinner fa-spin" : "fa-trash-can"}
                                        alt={isDeleting ? "Deleting..." : "Delete event"}
                                        onClick={() => onDelete(current.id)}
                                    />
                                ),
                            },
                            {
                                id: "duplicate",
                                navigation: { icon: isCopying ? "fa-spinner fa-spin" : "fa-copy", alt: "duplicate" },
                                content: (
                                    <UiButton onClick={onCopyEvent} variant="link" traits={{ afterIcon: isCopying ? "fa-spinner fa-spin" : "fa-copy" }}>
                                        Duplicate event
                                    </UiButton>
                                ),
                                kind: "control" as const,
                                navContent: <UiIcon icon={isCopying ? "fa-spinner fa-spin" : "fa-copy"} alt="Duplicate event" onClick={onCopyEvent} />,
                            },
                        ] : []),
                        {
                            id: "refresh",
                            navigation: { icon: "fa-arrows-rotate", alt: "refresh" },
                            content: (
                                <UiButton onClick={onRefresh} variant="link" traits={{ afterIcon: "fa-arrows-rotate" }}>
                                    Refresh events
                                </UiButton>
                            ),
                            kind: "control",
                            navContent: <UiIcon icon="fa-arrows-rotate" alt="Refresh events" onClick={onRefresh} />,
                        },
                    ]}
                />

            </div>
        </>
    );
};

export default EventsPanel;
