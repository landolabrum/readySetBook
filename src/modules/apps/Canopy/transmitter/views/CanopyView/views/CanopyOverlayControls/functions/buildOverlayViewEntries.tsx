import React from "react";
import UiForm from "@webstack/components/UiForm/controller/UiForm";
import type { IFormField } from "@webstack/components/UiForm/models/IFormModel";
import type { CanonOverlay, OverlayType } from "@Canopy/models/canopyOverlayTypes";
import { overlayFieldsFor } from "@Canopy/models/canopyOverlayTypes";
import type { TeamOption } from "@Canopy/transmitter/forms/CanopyTeamPicker/CanopyTeamPicker";
import { CanopyTeamPicker } from "@Canopy/transmitter/forms/CanopyTeamPicker/CanopyTeamPicker";
import CanopyGpsSourcePicker from "@Canopy/transmitter/forms/CanopyGpsSourcePicker/CanopyGpsSourcePicker";
import { truncateLabel } from "@Canopy/transmitter/views/CanopyView/functions/overlayHelpers";
import type { IEventRow, OverlayViewEntry } from "@Canopy/transmitter/views/CanopyView/functions/overlayControlTypes";
import LiveStreamTickerControls from "@Canopy/transmitter/forms/CanopyTickerForm/CanopyTickerForm";
import { CanopyScoreBoardControls } from "../views/CanopyScoreBoardControls/CanopyScoreBoardControls";
import CanopyOverlayMediaControls from "../views/CanopyOverlayMediaControls/controller/CanopyOverlayMediaControls";
import CanopyCameraControls from "../views/CanopyShareControls/views/CanopyCameraControls/CanopyCameraControls";
import CanopyScreenControls from "../views/CanopyShareControls/views/CanopyScreenControls/CanopyScreenControls";
import CanopyEncoderControls from "../views/CanopyShareControls/views/CanopyEncoderControls/CanopyEncoderControls";
import CanopyPullControls from "../views/CanopyShareControls/views/CanopyPullControls/CanopyPullControls";
import CanopyOverlayCardControls from "../views/CanopyOverlayCardControls/controller/CanopyOverlayCardControls";

type Args = {
  overlays: CanonOverlay[];
  current: IEventRow | null;
  eventId?: string;
  eventCenter: { lat?: number; lng?: number };
  teamOptions: TeamOption[];
  focusOverlay?: CanonOverlay;
  isEnabledOverlay: (ov?: CanonOverlay | null) => boolean;
  onChangeFor: (overlay: CanonOverlay) => (e: any) => void;
  onChangeTicker: (overlay: CanonOverlay) => (e: any) => void;
  onAddTickerField: (overlay: CanonOverlay) => (e: any) => void;
  toggleTeam: (overlay: CanonOverlay, veh: string) => void;
  selectAllTeams: (overlay: CanonOverlay) => void;
  clearTeams: (overlay: CanonOverlay) => void;
  showingAdvancedFields?: boolean;
};

export const buildOverlayViewEntries = ({
  overlays,
  current,
  eventId,
  eventCenter,
  teamOptions,
  focusOverlay,
  isEnabledOverlay,
  onChangeFor,
  onChangeTicker,
  onAddTickerField,
  toggleTeam,
  selectAllTeams,
  clearTeams,
  showingAdvancedFields,
}: Args): OverlayViewEntry[] => {
  const editable = overlays.filter((o) => o && isEnabledOverlay(o));
  const list: CanonOverlay[] = [];
  if (focusOverlay) list.push(focusOverlay);
  else if (editable.length) list.push(...editable);
  else list.push(...overlays.filter(Boolean));

  if (list.length === 0) {
    return [{ key: "none", label: "Overlays", view: <div className="form__hint">No overlays are configured for this event. Add them from the left panel.</div> }];
  }

  const renderOverlayView = (overlay: CanonOverlay): React.ReactNode => {
    if (overlay.type === "scoreboard") return <><CanopyScoreBoardControls current={current as any} /><UiForm title="Scoreboard" fields={overlayFieldsFor("scoreboard", overlay, { showAdvancedFields: showingAdvancedFields }) as IFormField[]} onChange={onChangeFor(overlay)} /></>;
    if (overlay.type === "ticker") return <LiveStreamTickerControls overlay={overlay as any} showingAdvancedFields={showingAdvancedFields} onChange={onChangeTicker(overlay)} onAddField={onAddTickerField(overlay)} />;
    if (overlay.type === "map") {
      return <><UiForm title="Map" fields={overlayFieldsFor("map", overlay, { eventDefaults: eventCenter, showAdvancedFields: showingAdvancedFields }) as IFormField[]} onChange={onChangeFor(overlay)} /><CanopyGpsSourcePicker value={(overlay.data as any)?.gps_sources ?? []} onChange={(next) => onChangeFor(overlay)({ name: 'data.gps_sources', value: next })} allow={['team']} teamOptions={teamOptions} multi /></>;
    }
    if (overlay.type === "hud") return <><CanopyGpsSourcePicker value={(overlay.data as any)?.gps_source ?? null} onChange={(next) => onChangeFor(overlay)({ name: 'data.gps_source', value: next })} allow={['manual', 'team', 'guardian']} teamOptions={teamOptions} eventDefaults={eventCenter} /><UiForm title="HUD" fields={overlayFieldsFor("hud", overlay, { showAdvancedFields: showingAdvancedFields }) as IFormField[]} onChange={onChangeFor(overlay)} /></>;
    if (overlay.type === "lapcounter") return <UiForm title="Lap Counter" fields={overlayFieldsFor("lapcounter", overlay, { showAdvancedFields: showingAdvancedFields }) as IFormField[]} onChange={onChangeFor(overlay)} />;
    if (overlay.type === "media") return <CanopyOverlayMediaControls overlay={overlay} eventId={eventId} showingAdvancedFields={showingAdvancedFields} onChange={onChangeFor(overlay)} />;
    if (overlay.type === "camera") return <CanopyCameraControls overlay={overlay} showingAdvancedFields={showingAdvancedFields} onChange={onChangeFor(overlay)} />;
    if (overlay.type === "screen") return <CanopyScreenControls overlay={overlay} showingAdvancedFields={showingAdvancedFields} onChange={onChangeFor(overlay)} />;
    if (overlay.type === "encoder") return <CanopyEncoderControls overlay={overlay} showingAdvancedFields={showingAdvancedFields} onChange={onChangeFor(overlay)} />;
    if (overlay.type === "pull") return <CanopyPullControls overlay={overlay} showingAdvancedFields={showingAdvancedFields} onChange={onChangeFor(overlay)} />;
    if (overlay.type === "weather") return <><CanopyGpsSourcePicker value={(overlay.data as any)?.gps_source ?? null} onChange={(next) => onChangeFor(overlay)({ name: 'data.gps_source', value: next })} allow={['manual', 'team', 'guardian']} teamOptions={teamOptions} eventDefaults={eventCenter} /><UiForm fields={overlayFieldsFor("weather", overlay, { eventDefaults: eventCenter, showAdvancedFields: showingAdvancedFields }) as IFormField[]} onChange={onChangeFor(overlay)} /></>;
    if (overlay.type === "card") return <CanopyOverlayCardControls overlay={overlay} current={current} onChange={onChangeFor(overlay)} />;
    return <UiForm title={overlay.type} fields={overlayFieldsFor(overlay.type, overlay, { showAdvancedFields: showingAdvancedFields }) as IFormField[]} onChange={onChangeFor(overlay)} />;
  };

  const typeCounters = new Map<OverlayType, number>();
  return list.map((overlay, idx) => {
    const key = overlay.id || `${overlay.type}-${idx}`;
    const count = (typeCounters.get(overlay.type) ?? 0) + 1;
    typeCounters.set(overlay.type, count);
    const rawTitle = (overlay.title ?? "").trim();
    const displayTitle = rawTitle ? truncateLabel(rawTitle) : "";
    const canDisplayLen = displayTitle?.length<10;
    const label = displayTitle && canDisplayLen ? `${displayTitle} (${overlay.type}${count > 1 ? ` #${count}` : ""})` : `${overlay.type} #${count}`;
    return { key, label, view: renderOverlayView(overlay) };
  });
};
