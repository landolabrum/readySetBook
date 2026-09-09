import React from "react";
import Obscurestyles from "../controller/Obscure.scss";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import StatusTiles from "../components/StatusTiles";
import { StatusTile } from "./types";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";

export type ObscureHeroProps = {
  onRefreshStatus: () => void;
  onReloadScenes: () => void;
  statusBusy: boolean;
  scenesBusy: boolean;
  status: StatusTile[];
};

const ObscureHero: React.FC<ObscureHeroProps> = ({
  onRefreshStatus,
  onReloadScenes,
  statusBusy,
  scenesBusy,
  status
}) => (<>
  <style jsx>{Obscurestyles}</style>
  <header className="obscure__hero">
    <div>
      <p className="obscure__eyebrow">obs websocket · protocol v5</p>
      {/* <h1>Obscure Control Studio</h1> */}
      <p className="obscure__lede">
        Live-inspect OBS health, stage scenes, and trigger transports without leaving the MindBurner webstack.
      </p>

    </div>
    <div className="obscure__hero-actions">
      <StatusTiles tiles={status} />
      <UiIcon icon="fa-rotate" onClick={onRefreshStatus} alt="refresh status" spin={statusBusy} />
      <UiIcon icon="fa-repeat" onClick={onReloadScenes} alt="refresh scenes" spin={scenesBusy} />
    </div>
  </header>
</>
);

export default ObscureHero;
