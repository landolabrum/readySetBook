import React from "react";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import panelStyles from "./GuardianPanel.scss";
import layoutStyles from "../../controller/Guardian.scss";
import GuardianLookupForm from "./GuardianLookupForm";
import { GuardianPanelProps } from "./types";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import Authentication from "~/src/modules/authentication/controller/Authentication";

const UnauthenticatedGuardianPanel: React.FC<GuardianPanelProps> = ({
  viewUserId,
  friends,
  onLookupUser,
  onViewUserIdChange,
  onAddFriend,
  onSelectFriend,
  onRemoveFriend,
  friendsLoading,
  shareDeviceId,
  onShareDeviceChange,
  viewDeviceId,
  lookupNote,
  viewFriendName,
  friendDisplayNames,
}) => {
  const { openModal } = useModal();
  const handleSignIn = () => {
    if (typeof window !== "undefined") {
      openModal({ title: "authentication", children: <Authentication view="sign-in" /> });
      // window.location.href = "/login";
    }
  };

  return (
    <>
      <style jsx>{layoutStyles}</style>
      <style jsx>{panelStyles}</style>
      <section className="guardian__panel">
        <header>
          <div>
            <h1>Stay in sync with your live location</h1>
            <p className="lede">
              Sign in to stream your own position, or quickly look up a friend’s ID to jump to their
              last known location.
            </p>
          </div>
          <div className="guardian__actions">
            <UiButton variant="primary" onClick={handleSignIn}>
              Sign in to start tracking
            </UiButton>
            <UiButton variant="flat" onClick={onLookupUser} disabled={!viewUserId}>
              View by user ID
            </UiButton>
          </div>
        </header>

        <div className="guardian__hint">
          You are not signed in. Sign in to share your live device location, or use the lookup below
          to monitor a known user ID in a pinch.
        </div>

        <GuardianLookupForm
          label="View someone by ID"
          description="Paste a user ID to center the map on their latest fix."
          viewUserId={viewUserId}
          friends={friends}
          loading={friendsLoading}
          viewFriendName={viewFriendName}
          friendDisplayNames={friendDisplayNames}
          onViewUserIdChange={onViewUserIdChange}
          onLookupUser={onLookupUser}
          onAddFriend={onAddFriend}
          onSelectFriend={onSelectFriend}
          onRemoveFriend={onRemoveFriend}
          lookupNote={lookupNote}
        />
      </section>
    </>
  );
};

export default UnauthenticatedGuardianPanel;
