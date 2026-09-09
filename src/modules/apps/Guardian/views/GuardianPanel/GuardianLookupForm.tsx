import React from "react";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import styles from "./GuardianPanel.scss";
import { GuardianLookupNote } from "./types";

type Props = {
  viewUserId: string;
  friends: string[];
  onViewUserIdChange: (val: string) => void;
  onLookupUser: (id?: string) => void;
  onAddFriend: (id?: string) => void;
  onSelectFriend: (id: string) => void;
  onRemoveFriend: (id: string) => void;
  lookupNote?: GuardianLookupNote | null;
  loading?: boolean;
  viewFriendName?: string;
  friendDisplayNames?: Record<string, string>;
  label?: string;
  description?: string;
  compact?: boolean;
};

const GuardianLookupForm: React.FC<Props> = ({
  viewUserId,
  friends,
  onViewUserIdChange,
  onLookupUser,
  onAddFriend,
  onSelectFriend,
  onRemoveFriend,
  lookupNote,
  loading = false,
  viewFriendName,
  friendDisplayNames,
  label = "View another user",
  description = "Enter a user ID to center the map and follow their latest location.",
  compact = false,
}) => {
  const [open, setOpen] = React.useState(!compact);
  const friendCountLabel =
    friends?.length
      ? `${friends.length} friend${friends.length === 1 ? "" : "s"} saved`
      : "No friends yet";

  return (
    <>
      <style jsx>{styles}</style>
      <div className="guardian__lookup">
        <div className="guardian__lookup-header">
          <div>
            <label>{label}</label>
            <p className="guardian__hint-text">{description}</p>
            <div className="guardian__friend-count">
              <strong>{friends?.length ?? 0}</strong>
              <span>{friendCountLabel}</span>
            </div>
            {viewFriendName ? (
              <div className="guardian__lookup-view">
                <span>Viewing</span>
                <strong>{viewFriendName}</strong>
              </div>
            ) : null}
          </div>
          {loading && <span className="guardian__lookup-pill">Syncing…</span>}
          <UiIcon icon={open ? "fa-chevron-up" : "fa-gear"} onClick={() => setOpen(!open)} />
        </div>
        {open && (
          <>
            <UiInput
              name="viewUserId"
              placeholder="User ID"
              value={viewUserId}
              onChange={(e: any) => onViewUserIdChange(e?.target?.value || "")}
              autoComplete="off"
            />
            <div className="guardian__lookup-actions">
              <UiButton variant="flat" onClick={() => onLookupUser(viewUserId)} disabled={!viewUserId}>
                View
              </UiButton>
              <UiButton variant="flat" onClick={() => onAddFriend(viewUserId)} disabled={!viewUserId}>
                Save Friend
              </UiButton>
            </div>
            {lookupNote ? (
              <div
                className={`guardian__lookup-note guardian__lookup-note--${lookupNote.tone}`}
                role={lookupNote.tone === "error" ? "alert" : undefined}
              >
                {lookupNote.message}
              </div>
            ) : null}
            {friends?.length ? (
              <div className="guardian__friends">
                <label>Friends</label>
                <div className="guardian__friends-list">
                  {friends.map((fid) => {
                    const displayName = friendDisplayNames?.[fid] ?? fid;
                    return (
                      <div key={fid} className="guardian__friend-chip">
                        <button
                          type="button"
                          className="guardian__friend-name"
                          onClick={() => onSelectFriend(fid)}
                          title={`View ${displayName}`}
                        >
                          {displayName}
                        </button>
                        <button
                          type="button"
                          className="guardian__friend-remove"
                          onClick={() => onRemoveFriend(fid)}
                          aria-label={`Remove ${displayName}`}
                          title="Remove friend"
                        >
                          x
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
};

export default GuardianLookupForm;
