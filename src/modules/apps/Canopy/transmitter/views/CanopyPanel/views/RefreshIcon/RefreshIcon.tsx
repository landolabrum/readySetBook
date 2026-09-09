import React, { useState } from "react";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import "./RefreshIcon.scss";

type Props = { onRefresh?: () => Promise<any> | any };

const RefreshIcon: React.FC<Props> = ({ onRefresh }) => {
    const [busy, setBusy] = useState(false);
    const handle = async () => {
        if (!onRefresh) return;
        try {
            setBusy(true);
            await onRefresh();
        } finally {
            setBusy(false);
        }
    };
    return (
        <UiIcon
            icon={busy ? "fa-spinner" : "fa-rotate"}
            spin={busy}
            onClick={busy ? undefined : handle}
            alt={busy ? "Refreshing…" : "Refresh events"}
            tooltipVariant="dark"
        />
    );
};

export default RefreshIcon;
