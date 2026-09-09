import React, { useMemo } from "react";
import styles from "./DirectMessagesConversation.scss";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import AdapTable, { TableOptions } from "@webstack/components/AdapTable/views/AdapTable";
import AdaptTableCell from "@webstack/components/AdapTable/components/AdaptTableContent/components/AdaptTableCell/AdaptTableCell";
import UiMarkdown from "@webstack/components/UiMarkDown/controller/UiMarkDown";
import { DmMessage, DmParticipant, DmThread, SearchCustomer } from "~/src/core/services/MemberService/IMemberService";
import { formatTimestamp } from "../../hooks/useDirectMessage";
import UiConversation from "@webstack/components/UiConversation/UiConversation";

type Props = {
    selectedFriendId: number | null;
    selectedFriend?: DmThread | null;
    unreadCount: number;
    friendLocation: string;
    friendLocationTime: string;
    messages: DmMessage[];
    dmBody: string;
    busy: boolean;
    hasMore: boolean;
    isActive: boolean;
    viewerId: string;
    participants?: DmParticipant[];
    onDmBodyChange: (value: string) => void;
    onSend: () => void;
    onLoadMore: () => void;
    onMarkRead: () => void;
    onRemoveFriend: () => void;
    onRemoveConversation: () => void;
    participantTerm: string;
    participantResults: DmParticipant[] | SearchCustomer[];
    participantSearching: boolean;
    participantStatus: string | null;
    participantError: string | null;
    onParticipantTermChange: (value: string) => void;
    onAddParticipant: (userId: string) => void;
    onRemoveParticipant: (userId: string) => void;
    memberCellData: (userId: string) => { name: string; id: string; email: string };
};

const dmOptions: TableOptions = {
    tableTitle: "Messages",
    hideColumns: ["id"],
    renderCell: (key, item) => {
        if (key === "sender" || key === "recipient") {
            return <AdaptTableCell cell="member" data={item[key]} />;
        }
        if (key === "body") {
            return <UiMarkdown text={item[key]} />;
        }
        return undefined;
    },
};

const DirectMessagesConversation: React.FC<Props> = ({
    selectedFriendId,
    selectedFriend,
    unreadCount,
    friendLocation,
    friendLocationTime,
    messages,
    dmBody,
    busy,
    hasMore,
    isActive,
    viewerId,
    participants,
    onDmBodyChange,
    onSend,
    onLoadMore,
    onMarkRead,
    onRemoveFriend,
    onRemoveConversation,
    participantTerm,
    participantResults,
    participantSearching,
    participantStatus,
    participantError,
    onParticipantTermChange,
    onAddParticipant,
    onRemoveParticipant,
    memberCellData,
}) => {
    const dmRows = useMemo(() => {
        const sorted = [...messages].sort((a, b) => {
            const aTs = a?.sentAt ? new Date(a.sentAt).getTime() : 0;
            const bTs = b?.sentAt ? new Date(b.sentAt).getTime() : 0;
            return aTs - bTs;
        });

        return sorted.map((m) => ({
            id: m.id,
            sender: memberCellData(m.senderId),
            recipient: memberCellData(m.recipientId),
            body: m.body,
            sent: formatTimestamp(m.sentAt),
            read: m.readAt ? formatTimestamp(m.readAt) : "—",
        }));
    }, [memberCellData, messages]);

    const title = useMemo(() => {
        const idSet = new Set<string>();
        (participants || []).forEach((p) => {
            if (p.userId && p.userId !== viewerId) idSet.add(p.userId);
        });
        (messages || []).slice(0, 10).forEach((m) => {
            if (m.senderId && m.senderId !== viewerId) idSet.add(m.senderId);
            if (m.recipientId && m.recipientId !== viewerId) idSet.add(m.recipientId);
        });

        const names = Array.from(idSet)
            .map((uid) => memberCellData(uid).name)
            .filter(Boolean);

        return (
            selectedFriend?.name ||
            names.join(", ") ||
            selectedFriend?.friendUserId ||
            selectedFriendId ||
            "Conversation"
        );
    }, [memberCellData, messages, participants, selectedFriend, selectedFriendId, viewerId]);

    if (!selectedFriendId) {
        return <div className="direct-messages__placeholder">Select a conversation to start messaging.</div>;
    }

    const disabledSend = !dmBody.trim();

    return (<>
        <style jsx>{styles}</style>
        <div
            className={`direct-messages__conversation${isActive ? " direct-messages__conversation--active" : ""
                }`}
        >
            <div className="direct-messages__dm-header">
                <div className="direct-messages__dm-header-left">
                    <div className="direct-messages__dm-title">
                        {title}
                    </div>
                    <div className="direct-messages__location-row">
                        <span className="direct-messages__location">Location: {friendLocation}</span>
                        <span className="direct-messages__location-time">Seen: {friendLocationTime}</span>
                    </div>
                </div>
                {unreadCount ? (
                    <UiButton
                        variant="link"
                        traits={{ afterIcon: { icon: "fa-check", badge: unreadCount } }}
                        onClick={onMarkRead}
                        busy={busy}
                    >
                        Mark read
                    </UiButton>
                ) : null}
                <UiButton
                    variant="ghost"
                    traits={{ afterIcon: { icon: "fa-user-xmark" } }}
                    onClick={onRemoveFriend}
                    busy={busy}
                >
                    Remove friend
                </UiButton>
                <UiButton
                    variant="ghost"
                    traits={{ afterIcon: { icon: "fa-trash-can" } }}
                    onClick={onRemoveConversation}
                    busy={busy}
                >
                    Remove conversation
                </UiButton>
            </div>

            <div className="direct-messages__participants">
                <div className="direct-messages__participants-title">Participants</div>
                <div className="direct-messages__participants-existing">
                    {(participants || []).map((p) => (
                        <div key={p.userId} className="direct-messages__participant-row">
                            <span>{memberCellData(p.userId).name}</span>
                            <UiButton
                                variant="link"
                                traits={{ afterIcon: { icon: "fa-user-xmark" } }}
                                onClick={() => onRemoveParticipant(p.userId)}
                                busy={busy}
                            >
                                Remove
                            </UiButton>
                        </div>
                    ))}
                    {!participants?.length && (
                        <div className="direct-messages__participants-empty">No participants yet.</div>
                    )}
                </div>

                <div className="direct-messages__participants-add">
                    <UiInput
                        label="Add participant"
                        placeholder="Search by name, email, or id"
                        value={participantTerm}
                        onChange={(e) => onParticipantTermChange(e.target.value)}
                        traits={{ afterIcon: participantSearching ? "fa-spinner" : "fa-search" }}
                    />
                    {participantError && <div className="direct-messages__error">{participantError}</div>}
                    {participantStatus && !participantError && (
                        <div className="direct-messages__status">{participantStatus}</div>
                    )}
                    {participantResults?.length ? (
                        <div className="direct-messages__participants-results">
                            {participantResults.map((r: any) => (
                                <div key={r.id || r.userId} className="direct-messages__participant-row">
                                    <span>{r.name || r.alias || r.email || r.id || r.userId}</span>
                                    <UiButton
                                        variant="primary"
                                        traits={{ afterIcon: { icon: "fa-user-plus" } }}
                                        busy={participantSearching}
                                        onClick={() => onAddParticipant(r.id || r.userId)}
                                    >
                                        Add
                                    </UiButton>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* <AdapTable data={dmRows} loading={busy} options={dmOptions} /> */}
            <UiConversation conversation={dmRows} loading={busy} />
            {hasMore && (
                <UiButton variant="flat" onClick={onLoadMore} busy={busy}>
                    Load more
                </UiButton>
            )}

            <div className="direct-messages__dm-compose">
                <UiInput
                    variant="markdown"
                    label="Message"
                    placeholder="Type a message"
                    value={dmBody}
                    onChange={(e) => onDmBodyChange(e.target.value)}

                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!disabledSend) { onSend(); } } }}
                    traits={{ afterIcon: { icon: "fa-plane", width: 59, height: 45, onClick: (e: any) => { e.preventDefault(); if (!disabledSend) { onSend(); } } } }}
                />
                {/* <div>
                    <UiButton
                        variant={disabledSend ? "disabled" : "primary"}
                        traits={{ afterIcon: { icon: "fa-plane" } }}
                        disabled={disabledSend}
                        onClick={onSend}
                        busy={busy}
                    >
                        Send
                    </UiButton>
                </div> */}
            </div>
        </div>
    </>
    );
};

export default DirectMessagesConversation;