import React from "react";
import Obscurestyles from "../controller/Obscure.scss";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import { classNames } from "@webstack/common";
import { ObsCommand, ObsScene } from "../hooks/useObscure";

type ScenesPanelProps = {
  scenes: ObsScene[];
  selectedScene: string | null;
  currentProgramScene: string | null;
  currentPreviewScene: string | null;
  scenesRefreshing: boolean;
  actionInFlight: ObsCommand | null;
  onSelect: (sceneName: string) => void;
  onCommit: () => void;
  onReload: () => void;
};

const ScenesPanel: React.FC<ScenesPanelProps> = ({
  scenes,
  selectedScene,
  currentProgramScene,
  currentPreviewScene,
  scenesRefreshing,
  actionInFlight,
  onSelect,
  onCommit,
  onReload,
}) => (
  <>
    <style jsx>{Obscurestyles}</style>
    <article className="obscure__panel">
      <header className="obscure__panel-head">
        {/* <div>
          <h2>Scenes</h2>
          <p>Select a scene to review it, then push it to program.</p>
        </div> */}
        <div className="obscure__panel-actions">
          <UiButton variant="ghost" busy={scenesRefreshing} onClick={onReload} aria-busy={scenesRefreshing}>
            Reload scenes
          </UiButton>
          <UiButton onClick={onCommit} disabled={!selectedScene} aria-busy={actionInFlight === "set_scene"}>
            Activate selection
          </UiButton>
        </div>
      </header>
      <div className="obscure__scene-grid">
        {scenes.length === 0 && (
          <div className="obscure__empty">
            No scenes returned yet. Reload scenes or verify OBS is connected.
          </div>
        )}
        {scenes.map((scene) => {
          const isProgram = currentProgramScene === scene.sceneName;
          const isPreview = currentPreviewScene === scene.sceneName;
          const isSelected = selectedScene === scene.sceneName;

          return (
            <div
              key={scene.sceneUuid ?? scene.sceneName}
              className={classNames({
                "obscure__scene": true,
                "obscure__scene--program": isProgram,
                "obscure__scene--preview": isPreview,
                "obscure__scene--selected": isSelected,
              })}
            >
              <UiButton variant={isProgram ? "primary" : "flat"} onClick={() => onSelect(scene.sceneName)}>
                <div className="obscure__scene-header">
                  <span>{scene.sceneName}</span>
                  <div className="obscure__scene-tags">
                    {isProgram && <span className="tag tag--program">Program</span>}
                    {isPreview && <span className="tag tag--preview">Preview</span>}
                  </div>
                </div>
                <p className="obscure__scene-meta">{scene.sceneUuid?.slice(0, 8) ?? "No UUID"}</p>
                <div className="obscure__scene-foot">
                  <span>Slot {scene.sceneIndex ?? "—"}</span>
                  {isSelected && <span className="obscure__scene-selected">staged</span>}
                </div>
              </UiButton>
            </div>
          );
        })}
      </div>
    </article>
  </>
);

export default ScenesPanel;
