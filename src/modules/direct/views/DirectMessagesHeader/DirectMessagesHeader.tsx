import React from "react";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import { SearchCustomer } from "~/src/core/services/MemberService/IMemberService";
import styles from "./DirectMessagesHeader.scss";

type Props = {
    totalUnread: number;
    error: string | null;
    status: string | null;
    followers: number;
    following: number;
    searchTerm: string;
    searching: boolean;
    searchStatus: string | null;
    searchError: string | null;
    searchResults: SearchCustomer[];
    onSearchTermChange: (value: string) => void;
    onAddFriend: (friendUserId: string, alias?: string) => void;
};

const DirectMessagesHeader: React.FC<Props> = ({
    totalUnread,
    error,
    status,
    followers,
    following,
    searchTerm,
    searching,
    searchStatus,
    searchError,
    searchResults,
    onSearchTermChange,
    onAddFriend,
}) => {
    return (
        <>
            <style jsx>{styles}</style>
            <div className="direct-messages__header">
                <div className="direct-messages__title">Direct messages</div>
                <div className="direct-messages__meta">Unread: {totalUnread}</div>
                <div className="direct-messages__meta">Following: {following}</div>
                <div className="direct-messages__meta">Followers: {followers}</div>
                {error && <div className="direct-messages__error">{error}</div>}
                {!error && status && <div className="direct-messages__status">{status}</div>}
            </div>

            <div className="direct-messages__search">
                <UiInput
                    label="Find customers"
                    placeholder="Search by name, email, or id"
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    traits={{ afterIcon: "fa-search" }}
                />
                <div className="direct-messages__search-hint">Min 3 characters · results come from backend</div>
                {searchError && <div className="direct-messages__error">{searchError}</div>}
                {!searchError && searchStatus && (
                    <div className="direct-messages__status">{searchStatus}</div>
                )}
            </div>

            {searchResults.length > 0 && (
                <div className="direct-messages__search-results">
                    <div className="direct-messages__search-title">Search results</div>
                    {searchResults.map((r) => (
                        <div key={r.id} className="direct-messages__search-row">
                            <div className="direct-messages__search-main">
                                <div className="direct-messages__search-name">{r.name || r.email || r.id}</div>
                                <div className="direct-messages__search-meta">{r.email}</div>
                                <div className="direct-messages__search-meta">{r.id}</div>
                            </div>
                            <UiButton
                                variant="primary"
                                busy={searching}
                                onClick={() => onAddFriend(r.id, r.name || r.email || undefined)}
                            >
                                Add friend
                            </UiButton>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default DirectMessagesHeader;