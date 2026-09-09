export type OverlayType =
  | 'scoreboard'
  | 'ticker'
  | 'map'
  | 'hud'
  | 'lapcounter'
  | 'media'
  | 'weather'
  | 'camera'
  | 'screen'
  | 'encoder'
  | 'pull'
  | 'card'
  | 'chat';

export type CanonOverlay = {
  id?: string;
  type: OverlayType;
  enabled: boolean;

  // layout
  x?: number;
  y?: number;
  width?: number;       // % of design surface (0–100)
  height?: number;      // % of design surface (0–100)
  crop?: [number, number, number, number]; // [top, bottom, left, right] inset % (0–100)
  z_index?: number;

  // presentation
  variant?:
    | 'default'
    | 'fullscreen'
    | 'blank'
    | 'image-left'
    | 'image-right'
    | 'time-temp'
    | null
    | string;
  animation?: string | null;

  // text
  label?: string | null;
  title?: string | null;
  description?: string | null;

  // payload
  data?: any;
};

export type OverlayIdContext = {
  userId?: string | null;
  streamId?: string | null;
};
