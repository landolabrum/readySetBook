import React from "react";
import styles from "./DirectMessages.scss";
import DirectMessagesHeader from "../views/DirectMessagesHeader/DirectMessagesHeader";
import DirectMessagesList from "../views/DirectMessagesList/DirectMessagesList";
import DirectMessagesConversation from "../views/DirectMessageConversation/DirectMessagesConversation";
import { useDirectMessage } from "../hooks/useDirectMessage";

const DirectMessages: React.FC = () => {
    const {
        dmBody,
        dmBusyFriend,
        error,
        followers,
        friendLocation,
        friendLocationTime,
        handleLoadMore,
        handleSelectFriend,
        handleSendDm,
        hasMoreMessages,
        loadingFriends,
        markThreadRead,
        removeFriend,
        removeConversation,
        participants,
        participantTerm,
        participantResults,
        participantSearching,
        participantStatus,
        participantError,
        setParticipantTerm,
        addParticipant,
        removeParticipant,
        memberCellData,
        messagesForSelected,
        addFriend,
        searchError,
        searchResults,
        searchStatus,
        searchTerm,
        searching,
        searchValue,
        selectedFriend,
        selectedFriendId,
        setDmBody,
        setSearchTerm,
        setSearchValue,
        status,
        following,
        threadRows,
        totalUnread,
        unreadByFriend,
        viewerId,
    } = useDirectMessage();
    const hasSelection = Boolean(selectedFriendId);
    const layoutClass = hasSelection
        ? "direct-messages__layout direct-messages__layout--split"
        : "direct-messages__layout direct-messages__layout--single";

    const busy = selectedFriendId ? dmBusyFriend === selectedFriendId : false;
    const unreadSelected = selectedFriendId ? unreadByFriend[selectedFriendId] || 0 : 0;

    return (
        <>
            <style jsx>{styles}</style>
            <div className="direct-messages">
                <DirectMessagesHeader
                    totalUnread={totalUnread}
                    error={error}
                    status={status}
                    followers={followers}
                    following={following}
                    searchTerm={searchTerm}
                    searching={searching}
                    searchStatus={searchStatus}
                    searchError={searchError}
                    searchResults={searchResults}
                    onSearchTermChange={setSearchTerm}
                    onAddFriend={addFriend}
                />

                <div className={layoutClass}>
                    <DirectMessagesList
                        threadRows={threadRows}
                        searchValue={searchValue}
                        loading={loadingFriends}
                        onSearchChange={setSearchValue}
                        onSelectFriend={handleSelectFriend}
                    />

                    {hasSelection ? (
                        <DirectMessagesConversation
                            selectedFriendId={selectedFriendId}
                            selectedFriend={selectedFriend}
                            unreadCount={unreadSelected}
                            friendLocation={friendLocation}
                            friendLocationTime={friendLocationTime}
                            messages={messagesForSelected}
                            participants={participants}
                            dmBody={dmBody}
                            busy={busy}
                            hasMore={hasMoreMessages}
                            isActive={hasSelection}
                            viewerId={viewerId}
                            onDmBodyChange={setDmBody}
                            onSend={handleSendDm}
                            onLoadMore={handleLoadMore}
                            onMarkRead={() =>
                                selectedFriendId ? markThreadRead(selectedFriendId) : undefined
                            }
                            onRemoveFriend={() =>
                                selectedFriendId ? removeFriend(undefined, selectedFriendId) : undefined
                            }
                            onRemoveConversation={() =>
                                selectedFriendId ? removeConversation(selectedFriendId) : undefined
                            }
                            participantTerm={participantTerm}
                            participantResults={participantResults}
                            participantSearching={participantSearching}
                            participantStatus={participantStatus}
                            participantError={participantError}
                            onParticipantTermChange={setParticipantTerm}
                            onAddParticipant={addParticipant}
                            onRemoveParticipant={removeParticipant}
                            memberCellData={memberCellData}
                        />
                    ) : null}
                </div>
            </div>
        </>
    );
};

export default DirectMessages;
