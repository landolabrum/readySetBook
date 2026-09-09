import type { ReactNode } from "react";
import type { CanonOverlay, OverlayType } from "@Canopy/models/canopyOverlayTypes";

export type IEventRow = {
  id: string;
  name: string;
  overlays?: any[];
  lat?: number | null;
  lng?: number | null;
};

export type OverlayViewEntry = {
  key: string;
  label: string;
  view: ReactNode;
};

export type OverlayActionHandlers = {
  onChangeFor: (overlay: CanonOverlay) => (e: any) => void;
  onChangeTicker: (overlay: CanonOverlay) => (e: any) => void;
  onAddTickerField: (overlay: CanonOverlay) => (e: any) => void;
  toggleTeam: (overlay: CanonOverlay, veh: string) => void;
  selectAllTeams: (overlay: CanonOverlay) => void;
  clearTeams: (overlay: CanonOverlay) => void;
};

export type FocusSelection = {
  focusId?: string;
  focusOverlay?: CanonOverlay;
};

export type OverlayPatch = (
  id: string | undefined,
  type: OverlayType,
  name: string,
  value: any,
) => void;
