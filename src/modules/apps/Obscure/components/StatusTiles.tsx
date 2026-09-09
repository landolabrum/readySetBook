import React from "react";
import Obscurestyles from "../controller/Obscure.scss";
import AdaptGrid from "@webstack/components/Containers/AdaptGrid/AdaptGrid";
import { classNames } from "@webstack/common";
import { StatusTile } from "./types";

type StatusTilesProps = {
  tiles: StatusTile[];
};

const StatusTiles: React.FC<StatusTilesProps> = ({ tiles }) => (<>
<style jsx>{Obscurestyles}</style>

  <section className="obscure__status">
      {tiles.map((tile) => (
          <div
          key={tile.label}
          className={classNames({
              "obscure__status-tile": true,
              "is-busy": Boolean(tile.busy),
            })}
            >
          <span className="obscure__status-label">{tile.label}</span>
          <strong className="obscure__status-value">{tile.status}</strong>
          {tile.meta && <span className="obscure__status-meta">{tile.meta}</span>}
        </div>
      ))}
  </section>
      </>
);

export default StatusTiles;
