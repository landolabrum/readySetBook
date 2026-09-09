import React, { useMemo } from "react";
import styles from "./DirectMessagesList.scss";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import AdapTable, { TableOptions } from "@webstack/components/AdapTable/views/AdapTable";
import { ThreadRow } from "../../hooks/useDirectMessage";
import useWindow from "@webstack/hooks/window/useWindow";
import UiCollapse from "@webstack/components/UiCollapse/UiCollapse";

type Props = {
    threadRows: ThreadRow[];
    searchValue: string;
    loading: boolean;
    onSearchChange: (value: string) => void;
    onSelectFriend: (threadId: number) => void;
};

const tableOptions: TableOptions = {
    // tableTitle: "Direct Messages",
    hideColumns: ["lastMessage", "threadId"],
    renderCell: (key, item) => {
        if (key === "unread") {
            const val = Number(item.unread || 0);
            if (!val) return "";
            return <span className="direct-messages__badge">{val}</span>;
        }
        return undefined;
    },
};

const DirectMessagesList: React.FC<Props> = ({
    threadRows,
    searchValue,
    loading,
    onSearchChange,
    onSelectFriend,
}) => {
    const {width}=useWindow();
    const filteredRows = useMemo(() => {
        const term = searchValue.trim().toLowerCase();
        if (!term) return threadRows;
        return threadRows.filter(
            (row) =>
                String(row.threadId).toLowerCase().includes(term) ||
                row.title.toLowerCase().includes(term)
        );
    }, [searchValue, threadRows]);

    return (
        <>
            <style jsx>{styles}</style>
            <div className="direct-messages__list">
                {width > 1100 ?              <>
                <h6>Direct Messages</h6>
                    <UiInput
                        label="Filter friends"
                        placeholder="Search by id or alias"
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        traits={{}}
                    />
                    <AdapTable
                        data={filteredRows}
                        loading={loading}
                        options={tableOptions}
                        onRowClick={(row) => onSelectFriend(row.threadId)}
                    /></>:
                    <UiCollapse label="Direct Messages"><>
                        <UiInput
                            label="Filter friends"
                            placeholder="Search by id or alias"
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            traits={{}}
                            />
                        <AdapTable
                            data={filteredRows}
                            loading={loading}
                            options={tableOptions}
                            onRowClick={(row) => onSelectFriend(row.threadId)}
                            />
                            </>
                        </UiCollapse>}
            </div>
        </>
    );
};

export default DirectMessagesList;