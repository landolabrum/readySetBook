import { type CanonOverlay } from "@Canopy/models/canopyOverlayTypes";

export type SourceMode = "prop" | "local" | "server";
export type Overlay = CanonOverlay;

export type Team = {
  id?: number | string;
  name?: string;
  competitor?: string;
  competitors?: Array<{ id?: string; name?: string | null; role?: string | null; position?: number | null }>;
  place?: number;
  score?: number;
  color?: string;
  gps?: string;
  speedMph?: number;
  vehicle_number?: string;
};

export interface UseCanopyMediaEngineProps {
  overlays?: Overlay[] | null | undefined;
  eventId?: string | number;
  eventMeta?: Record<string, any> | null;
  source?: SourceMode;
  pollMs?: number;
  useSSE?: boolean;
  fullScreen?: boolean;
  x?: number;
  y?: number;
  teamsOverride?: Team[];
  appendTeamsOverride?: boolean;
  suppressEmptyPlaceholder?: boolean;
  designWidth?: number;
  designHeight?: number;
  // Pipeline local preview support
  localPipelineStream?: MediaStream;
  pipelineSessionId?: string;
  pipelineHlsUrl?: string;
  /** Per-session stream lookup — lets multiple share overlays each resolve to their own track. */
  getStreamForSession?: (sessionId: string | null | undefined) => MediaStream | null;
  onOverlayClick?: (overlay?: Overlay) => void;
}

export type PresentItem = { key: string; ov: Overlay; state: "enter" | "stay" | "exit" };
