// src/functions/initializeMap.ts
import { Map as MapboxMap } from "mapbox-gl";
import { IVessel, IVesselActions } from "../models/IMapVessel";
import { flyToView } from "./mapControls";
import mapRotate from "./mapRotate";
import addVesselLines, { VESSEL_LINE_LAYER_ID } from "./addVesselLines";

interface InitializeMapParams {
  map: MapboxMap;
  vessels?: IVessel[];
  vesselActions: IVesselActions;
  mapOptions: {
    zoom?: number;
    pitch?: number;
    rpm?: number;
    center?: [number, number];
  };
  stopLoader: () => void;
  setLngLat: (lngLat: [number, number]) => void;
  setZoom: (zoom: number) => void;
  hideHover?: boolean;

  /** If true, recenter once when we first obtain a user fix. Default: false */
  recenterOnFirstUserFix?: boolean;
}

const initializeMap = ({
  map,
  vessels,
  vesselActions,
  mapOptions,
  stopLoader,
  setLngLat,
  setZoom,
  hideHover,
  recenterOnFirstUserFix = false,
}: InitializeMapParams) => {
  // ---- Helpers ---------------------------------------------------------
  const attachLinesOnTop = () => {
    map.once("idle", () => {
      if (map.getLayer(VESSEL_LINE_LAYER_ID)) {
        try {
          map.moveLayer(VESSEL_LINE_LAYER_ID);
        } catch {
          /* ignore if already top */
        }
      }
    });
  };

  // ---- First-time heavy init (style+sources+markers). Runs ONCE. -------
  map.once("style.load", async () => {
    try {
      if (mapOptions?.pitch) map.setPitch(mapOptions.pitch);

      const initialVessels = (vessels ?? []).map((v, i) => ({ ...v, id: v.id ?? i + 1 }));

      // Connecting lines (markers are managed reactively elsewhere to avoid duplicates)
      addVesselLines(map, initialVessels);
      attachLinesOnTop();

      // 3) Rotation (if enabled)
      if (mapOptions?.rpm) {
        mapRotate(map, {
          zoom: mapOptions?.zoom || map.getZoom(),
          rpm: mapOptions.rpm,
          maxZoom: (mapOptions?.zoom ?? map.getZoom()) + 5,
        });
      }
    } catch (e) {
      console.error("Error initializing map:", e);
    } finally {
      stopLoader();
    }
  });

  // ---- Lightweight rewire for subsequent style changes -----------------
  // If you call map.setStyle later, the style graph is reset. Re-attach
  // ONLY the minimal visual dependencies here — do NOT move the camera.
  map.on("styledata", () => {
    // Keep lines on top after any style graph change
    attachLinesOnTop();
    // If addVessels/addVesselLines require re-adding after style switch,
    // ensure those funcs internally no-op when layers/sources already exist.
  });

  // ---- Mirror map position into React state (read-only) ----------------
  map.on("move", () => {
    // Important: derive from the MAP, not from mapOptions.center (which is static)
    const c = map.getCenter().toArray() as [number, number];
    setLngLat(c);
    setZoom(map.getZoom());
  });
};

export default initializeMap;
