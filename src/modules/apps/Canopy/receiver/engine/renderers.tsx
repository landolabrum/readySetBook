import { createOverlayRenderer, type OverlayRenderContext } from "../../lib/overlayRegistry";

export type RenderContext = OverlayRenderContext;

export const createRenderOverlay = (ctx: RenderContext) => createOverlayRenderer(ctx);