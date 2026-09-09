import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./CanopyOverlayControls.scss";
import type { CanonOverlay } from "@Canopy/models/canopyOverlayTypes";
import { coerceEnabled, resetOverlayLayout } from "@Canopy/models/canopyOverlayTypes";
import { useOverlayStore, LS_OVERLAY_PREFIX, LS_META_PREFIX } from "@Canopy/hooks/useOverlayStore";
import useLocalStorage from "@webstack/hooks/storage/useLocalStorage";
import UiButtonGroup from "@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup";
import { useLiveStreamCtx } from "@Canopy/context/CanopyProvider";
import UiMarkdown from "@webstack/components/UiMarkDown/controller/UiMarkDown";
import { toFloatOrUndef } from "../../../functions/overlayHelpers";
import type { IEventRow } from "../../../functions/overlayControlTypes";
import { useOverlayEventHandlers } from "../functions/useOverlayEventHandlers";
import { useOverlayFocusSelection } from "../functions/useOverlayFocusSelection";
import { useOverlayRosterTeams } from "../functions/useOverlayRosterTeams";
import { useWeatherSeed } from "../functions/useWeatherSeed";
import { buildOverlayViewEntries } from "../functions/buildOverlayViewEntries";

type Props = {
  current: IEventRow | null;
  overlays?: CanonOverlay[] | null;
};

const CanopyOverlayControls: React.FC<Props> = ({ current, overlays: injected }) => {
  const eventId = current?.id ? String(current.id) : undefined;
  const lsKey = eventId ? `${LS_OVERLAY_PREFIX}${eventId}` : undefined;
  const metaKey = eventId ? `${LS_META_PREFIX}${eventId}` : undefined;

  const [focusIdOverride, setFocusIdOverride] = useState<string | undefined>(undefined);
  const [showingAdvancedFields, setShowingAdvancedFields] = useState(false);
  const { overlays, setOverlays, meta } = useOverlayStore(eventId, current?.name);
  const { setLocalItem: setOverlayLS } = useLocalStorage(lsKey);
  const { setLocalItem: setMetaLS, getLocalItem: getMetaLS } = useLocalStorage(metaKey);
  const { roster, saveOverlaysById } = useLiveStreamCtx();

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as any;
      const id = detail?.id;
      if (id) setFocusIdOverride(String(id));
    };
    window.addEventListener("canopy:focus-overlay", handler as any);
    return () => window.removeEventListener("canopy:focus-overlay", handler as any);
  }, []);

  const source = injected ?? overlays;
  const allOverlays = useMemo<CanonOverlay[]>(() => (Array.isArray(overlays) ? overlays : []), [overlays]);
  const displayOverlays = useMemo(() => (Array.isArray(source) ? source : []), [source]);
  const isEnabledOverlay = useCallback((ov?: CanonOverlay | null) => coerceEnabled(ov?.enabled), []);
  const showWeather = useMemo(() => displayOverlays.some((o) => o.type === "weather"), [displayOverlays]);

  const eventCenter = useMemo(
    () => ({ lat: toFloatOrUndef(current?.lat), lng: toFloatOrUndef(current?.lng) }),
    [current?.lat, current?.lng],
  );

  const { patch, onChangeFor, onChangeTicker, onAddTickerField } = useOverlayEventHandlers({
    setOverlays,
    lsKey,
    setOverlayLS,
    eventId,
    saveOverlaysById,
  });

  const { teamOptions, toggleTeam, selectAllTeams, clearTeams } = useOverlayRosterTeams({
    eventId,
    displayOverlays,
    roster,
    setOverlays,
    patch,
  });

  useWeatherSeed({
    showWeather,
    allOverlays,
    setOverlays,
    currentName: current?.name,
    lsKey,
    setOverlayLS,
  });

  const focusSelection = useOverlayFocusSelection({
    focusIdOverride,
    meta,
    metaKey,
    getMetaLS,
    displayOverlays,
    allOverlays,
    overlays: allOverlays,
  });

  const viewEntries = useMemo(
    () =>
      buildOverlayViewEntries({
        overlays: displayOverlays,
        current,
        eventId,
        eventCenter,
        teamOptions,
        focusOverlay: focusSelection.focusOverlay,
        isEnabledOverlay,
        onChangeFor,
        onChangeTicker,
        onAddTickerField,
        toggleTeam,
        selectAllTeams,
        clearTeams,
        showingAdvancedFields,
      }),
    [
      displayOverlays,
      current,
      eventId,
      eventCenter,
      teamOptions,
      focusSelection.focusOverlay,
      isEnabledOverlay,
      onChangeFor,
      onChangeTicker,
      onAddTickerField,
      toggleTeam,
      selectAllTeams,
      clearTeams,
      showingAdvancedFields,
    ],
  );

  return (
    <>
      <style jsx>{styles}</style>
      <div className="canopy-overlay-controls">
        {!eventId && <div className="form__hint">Select an event to manage overlays.</div>}
        {eventId && (
          <div className="canopy-overlay-controls--list">
            {viewEntries.length === 0 ? (
              <div className="form__hint">No overlays are configured for this event. Add them from the left panel.</div>
            ) : (
              viewEntries.map((entry) => (
                <div className="overlay-panel" key={entry.key}>
                  <div className="overlay-panel__header">
                    {entry.label?.length ? <UiMarkdown text={entry.label} /> : null}
                    <div className="overlay-panel__header--actions">
                      <UiButtonGroup
                        direction="ltr"
                        btns={[
                          {
                            label: "Advanced",
                            name: "advanced",
                            variant: "flat",
                            traits: { afterIcon: showingAdvancedFields ? "fa-eye-slash" : "fa-gear" },
                            onClick: () => setShowingAdvancedFields((prev) => !prev),
                          },
                          ...(showingAdvancedFields
                            ? [{
                              label: "Reset Layout",
                              name: "reset-layout",
                              variant: !focusSelection.focusOverlay ? "disabled" : "flat",
                              disabled: !focusSelection.focusOverlay,
                              traits: { afterIcon: "fa-rotate-left" },
                              onClick: async () => {
                                const target = focusSelection.focusOverlay;
                                if (!target) return;
                                const next = allOverlays.map((o) =>
                                  o.id === target.id ? resetOverlayLayout(o) : o,
                                );
                                setOverlays(() => next);
                                setFocusIdOverride(target.id);
                                if (eventId && saveOverlaysById) {
                                  void saveOverlaysById(String(eventId), next as any).catch(() => {});
                                }
                              },
                            }]
                            : []),
                          {
                            label: coerceEnabled(focusSelection.focusOverlay?.enabled) ? "Disable" : "Enable",
                            name: "toggle-enabled",
                            variant: !focusSelection.focusOverlay ? "disabled" : "link",
                            disabled: !focusSelection.focusOverlay,
                            traits: { afterIcon: coerceEnabled(focusSelection.focusOverlay?.enabled) ? "fa-eye-slash" : "fa-eye" },
                            onClick: async () => {
                              const target = focusSelection.focusOverlay;
                              if (!target) return;
                              const next = allOverlays.map((o) =>
                                o.id === target.id ? { ...o, enabled: !coerceEnabled(o.enabled) } : o,
                              );
                              setOverlays(() => next);
                              setFocusIdOverride(target.id);
                              if (eventId && saveOverlaysById) {
                                void saveOverlaysById(String(eventId), next as any).catch(() => {});
                              }
                            },
                          },
                          {
                            label: "Delete",
                            name: "delete",
                            variant: "warning",
                            traits: { afterIcon: "fa-trash-can" },
                            onClick: async () => {
                              const target = focusSelection.focusOverlay;
                              if (!target) return;
                              const next = allOverlays.filter((o) => o.id !== target.id);
                              setOverlays(() => next);
                              if (metaKey) {
                                try {
                                  const prevMeta = (getMetaLS?.(metaKey) as any) || {};
                                  const nextMeta = { ...prevMeta } as any;
                                  if (String((prevMeta as any)?.t ?? "") === String(target.id)) delete nextMeta.t;
                                  setMetaLS(metaKey, nextMeta);
                                } catch {
                                  // ignore
                                }
                              }
                              setFocusIdOverride(undefined);
                            },
                          },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="overlay-panel__body">{entry.view}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CanopyOverlayControls;