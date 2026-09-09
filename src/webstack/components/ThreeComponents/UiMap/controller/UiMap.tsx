import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map as MapboxMap, Marker } from "mapbox-gl";
// import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot, Root } from "react-dom/client";
import styles from "./UiMap.scss";
import useWindow from "@webstack/hooks/window/useWindow";
import { IVessel, IVesselActions } from "../models/IMapVessel";
import { flyToView } from "../functions/mapControls";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import MapVesselDetails, { IVesselType } from "../views/MapVessel/views/MapVesselDetails/MapVesselDetails";
import initializeMap from "../functions/initializeMap";
import handleResize from "../functions/handleResize";
import { getCamera, saveCamera } from "../functions/mapCamera";
import MapVesselMarker from "../views/MapVessel/views/MapVesselMarker/MapVesselMarker";
import MapVesselCluster from "../views/MapVessel/views/MapVesselCluster/MapVesselCluster";
import { groupVesselsByCoord } from "../functions/groupVesselsByCoord";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
mapboxgl.accessToken = MAPBOX_TOKEN;

interface MapOptions {
    center?: [number, number];
    zoom?: number;
    rpm?: number;
    loadingDelay?: number;
    pitch?: number;
    bearing?: number;
    tools?: any;
}

interface UiMapProps {
    options?: MapOptions;
    vessels?: IVessel[];
    onVesselClick?: (vessel: IVessel) => void;
    hideHover?: boolean;
    variant?: "fullscreen" | "embedded";
    onUserInteraction?: () => void;
    /** When this token changes, force a map repaint (e.g., new timeline response). */
    refreshToken?: string | number | null;
}

// WebGL feature detection
const isWebGLSupported = (): boolean => {
    if (typeof window === "undefined") return false;
    try {
        const canvas = document.createElement("canvas");
        return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch {
        return false;
    }
};
const VESSEL_ZOOM = 12;
const UiMap: React.FC<UiMapProps> = ({ options, vessels, onVesselClick, hideHover, variant = 'fullscreen', onUserInteraction, refreshToken }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapboxMap | null>(null);
    const markersRef = useRef<Map<string | number, { marker: Marker; root: Root | null }>>(new Map());
    const mapInitializedRef = useRef(false);
    const resizeRafRef = useRef<number | null>(null);
    const initialStyleID = "cmqxgkkyc001u01s7fes89eis";
    const [loader, setLoader] = useState<any>({ active: false });
    const [selectedVessel, setSelectedVessel] = useState<IVessel | null>(null);
    const [styleId, setStyleId] = useState(initialStyleID);
    const [mapError, setMapError] = useState<string | null>(null);
    const { width: windowWidth, height: windowHeight } = useWindow();
    // const calculateZoomLevel = (width: number): number => {
    //     const minZoom = 0.3;
    //     const maxZoom = 2;
    //     const minWidth = 900;
    //     const maxWidth = 1400;
    //     if (width < minWidth) return minZoom;
    //     if (width > maxWidth) return maxZoom;
    //     return ((width - minWidth) / (maxWidth - minWidth)) * (maxZoom - minZoom) + minZoom;
    // };

    // const globeZoom = calculateZoomLevel(windowWidth);
    const [zoomLevel, setZoomLevel] = useState<number>(options?.zoom ?? 15);
    const [centerCoordinates, setCenterCoordinates] = useState<[number, number]>(options?.center ?? [0, 10]);

    useEffect(() => {
        if (options?.center && mapRef.current && options?.zoom !== undefined) {
            setCenterCoordinates(options.center);
        }
    }, [options?.center, options?.zoom]);

    const requestedBearing = options?.bearing;

    const handleVesselClick = (vessel: IVessel) => {
        const map = mapRef.current;
        if (!vessel) return;
        if (map) saveCamera(getCamera(map));
        //   setSelectedVessel(vessel);
        onVesselClick?.(vessel);
        //   if (!header?.hide) setHeader({ hide: true });
    };


    const vesselActions: IVesselActions = useMemo(
        () => ({
            onClick: handleVesselClick,
            onMouseEnter: () => { },
            onMouseLeave: () => { },
        }),
        [handleVesselClick]
    );

    const stopLoader = () => {
        if (!options?.loadingDelay) {
            setLoader({ active: false });
        } else {
            setTimeout(() => setLoader({ active: false }), options.loadingDelay);
        }
    };
    const closeVessel = useCallback(() => {
        setSelectedVessel(null);
        // header?.hide && setHeader({ hide: false });
    }, [])
    // Initialize Mapbox once (do not tie lifecycle to center/zoom updates).
    useEffect(() => {
        if (typeof window === "undefined") return;

        const containerEl = mapContainerRef.current;
        const hasContainer = Boolean(containerEl);
        if (hasContainer && !mapRef.current && !loader.active) {
            setLoader({ active: true, body: " ", iconSize: windowWidth <= 1100 ? "70vw" : "350px" });
        } else if (!hasContainer && loader.active) {
            stopLoader();
        }

        if (hasContainer) {
            const canRenderWebGL = isWebGLSupported() && mapboxgl.supported();
            if (!canRenderWebGL) {
                setMapError("WebGL is not supported in this environment, so the map cannot be rendered.");
                stopLoader();
                return;
            }
            setMapError(null);

            try {
                const mapConfig = {
                    container: containerEl as HTMLElement,
                    center: centerCoordinates,
                    zoom: zoomLevel,
                    style: `mapbox://styles/mb1-api-1/${styleId}`,
                    projection: { name: "globe" } as any,
                    antialias: true,
                    rpm: options?.rpm || 0,
                    pitch: options?.pitch || 0,
                    bearing: options?.bearing ?? 0,
                } as mapboxgl.MapboxOptions & { rpm?: number };
                const map = new mapboxgl.Map(mapConfig);
                mapRef.current = map;
                mapInitializedRef.current = true;

                initializeMap({
                    map,
                    vessels,
                    vesselActions,
                    mapOptions: {
                        zoom: mapConfig.zoom,
                        pitch: mapConfig.pitch,
                        rpm: options?.rpm || 0,
                        center: centerCoordinates as [number, number],
                    },
                    stopLoader,
                    setLngLat: () => undefined, // avoid feedback loops from map move events
                    setZoom: () => undefined,
                    hideHover,
                });

                const handleUserMove = (event: mapboxgl.MapboxEvent & { originalEvent?: any }) => {
                    if (event?.originalEvent) onUserInteraction?.();
                };
                if (onUserInteraction) {
                    map.on("dragstart", handleUserMove);
                    map.on("zoomstart", handleUserMove);
                    map.on("rotatestart", handleUserMove);
                    map.on("pitchstart", handleUserMove);
                }

                return () => {
                    if (onUserInteraction) {
                        map.off("dragstart", handleUserMove);
                        map.off("zoomstart", handleUserMove);
                        map.off("rotatestart", handleUserMove);
                        map.off("pitchstart", handleUserMove);
                    }
                    markersRef.current.forEach(({ marker }) => {
                        try { marker.remove(); } catch { }
                    });
                    markersRef.current = new Map();
                    map.remove();
                    mapRef.current = null;
                    mapInitializedRef.current = false;
                };
            } catch (err) {
                console.error("🧨 Failed to initialize Mapbox GL:", err);
                stopLoader();
            }
        }
    }, [styleId]);

    // Lightweight marker updates without reloading the map
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const list: IVessel[] = [];
        if (Array.isArray(vessels) && vessels.length) list.push(...vessels);

        // Bucket co-located vessels so devices sharing a coordinate (identical
        // IP-geo behind one WAN) draw as one fan-out cluster instead of stacking
        // invisibly on a single pixel.
        const groups = groupVesselsByCoord(list);
        const nextIds = new Set<string | number>();

        const renderGroup = (group: { key: string; vessels: IVessel[] }) =>
            group.vessels.length > 1
                ? MapVesselCluster({ groupKey: group.key, vessels: group.vessels, ...vesselActions, hideHover })
                : MapVesselMarker({ vessel: { ...group.vessels[0], active: true }, ...vesselActions, hideHover });

        groups.forEach((group) => {
            const gid = group.key;
            nextIds.add(gid as any);

            const existing = markersRef.current.get(gid as any);
            if (existing) {
                try {
                    existing.marker.setLngLat(group.lngLat);
                    // re-render to reflect state changes (tracking pulse, membership)
                    existing.root?.render(renderGroup(group));
                } catch (err) {
                    console.warn("[map] failed to move marker", err);
                }
                return;
            }

            const el = document.createElement("div");
            const root = createRoot(el);
            root.render(renderGroup(group));
            try {
                const marker = new mapboxgl.Marker(el).setLngLat(group.lngLat).addTo(map);
                markersRef.current.set(gid as any, { marker, root });
            } catch (err) {
                console.error("[map] failed to render marker", err);
                root.unmount();
            }
        });

        // Remove markers that are no longer present (defer to avoid sync unmount warnings)
        setTimeout(() => {
            markersRef.current.forEach((entry, key) => {
                if (nextIds.has(key)) return;
                try { entry.marker.remove(); } catch { }
                markersRef.current.delete(key);
            });
        }, 0);

        // If exactly one marker, fly to it for better visibility
        if (list.length === 1 && list[0]?.lngLat) {
            try {
                // flyToView(map, { lngLat: list[0].lngLat as [number, number], zoom: Math.max(13, options?.zoom ?? 13) });
            } catch {/* ignore */ }
        }
    }, [vessels, hideHover, vesselActions]);

    useEffect(() => {
        if (mapContainerRef.current) {
            mapRef.current?.resize();
        }
    }, [selectedVessel, mapRef.current, mapContainerRef]);

    useEffect(() => {
        mapRef.current?.resize();
    }, [windowWidth, windowHeight]);

    useEffect(() => {
        if (typeof window === "undefined" || typeof ResizeObserver === "undefined") return;
        const el = mapContainerRef.current;
        if (!el) return;

        const observer = new ResizeObserver(() => {
            if (resizeRafRef.current) {
                window.cancelAnimationFrame(resizeRafRef.current);
            }
            resizeRafRef.current = window.requestAnimationFrame(() => {
                mapRef.current?.resize();
            });
        });

        observer.observe(el);
        return () => {
            observer.disconnect();
            if (resizeRafRef.current) {
                window.cancelAnimationFrame(resizeRafRef.current);
            }
        };
    }, [variant]);

    // Recenter when a center prop is provided/updated
    useEffect(() => {
        const map = mapRef.current;
        const c = options?.center;
        if (!map || !Array.isArray(c) || c.length !== 2) return;
        const [lon, lat] = c.map((n) => Number(n));
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
        setCenterCoordinates([lon, lat]);
        try {
            map.easeTo({
                center: [lon, lat],
                zoom: options?.zoom ?? Math.max(map.getZoom(), 15),
                essential: true,
                duration: 600,
            });
        } catch {/* ignore */ }
    }, [options?.center?.[0], options?.center?.[1], options?.zoom]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (typeof requestedBearing !== "number") return;
        map.easeTo({ bearing: requestedBearing, duration: 600, essential: true });
    }, [requestedBearing]);

    useEffect(() => {
        if (refreshToken === undefined || refreshToken === null) return;
        const map = mapRef.current;
        if (!map) return;
        try {
            map.resize();
            if (typeof (map as any).triggerRepaint === "function") {
                (map as any).triggerRepaint();
            }
        } catch {/* ignore */ }
    }, [refreshToken]);

    const handleResizeCallback = useCallback((newSize: any) => {
        handleResize(
            mapContainerRef,
            mapRef,
            selectedVessel !== null,
            newSize,
            (value: false | IVessel | null) => setSelectedVessel(value === false ? null : value),
            selectedVessel,
        );
    }, [windowWidth, windowHeight, zoomLevel]);
    const tools = options?.tools;
    return (
        <>
            <style jsx>{styles}</style>
            <div className={variant === "fullscreen" ? "map-container" : "embedded"}>
                <div
                    className="map-content"
                    style={variant !== "fullscreen" ? { height: "100%", width: "100%", position: "relative" } : undefined}
                >
                    <div
                        className="map"
                        ref={mapContainerRef}
                        onDoubleClick={closeVessel}
                        style={variant !== "fullscreen" ? { height: "100%", width: "100%" } : undefined}
                    />
                    {selectedVessel && (
                        <MapVesselDetails
                            closeVessel={closeVessel}
                            vessel={selectedVessel}
                            setVessel={setSelectedVessel as (vessel: IVesselType) => void}
                            onResize={handleResizeCallback}
                        />
                    )}
                    {mapError && (
                        <div className="map-error-message" role="alert">
                            {mapError}
                        </div>
                    )}
                    {!loader.active && options?.tools && (
                        <div className="map-tools">
                            <div className="map-tools--layer">


                                <UiIcon icon="fa-xmark" onClick={() => setStyleId("clwvqyuxe01bl01q11d6m8nh7")} />

                            </div>
                            <div className='d-flex s-w-100'> </div>
                            {tools && typeof tools !== "boolean" && tools}
                            {/* <MapSearch searched={searched} handleSearch={handleSearch} /> */}
                            <UiIcon
                                onClick={() => flyToView(mapRef.current, { zoom: zoomLevel > Number(options?.zoom) ? options?.zoom : VESSEL_ZOOM })}
                                icon={zoomLevel > VESSEL_ZOOM ? "fa-globe" : "fa-map"}
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default UiMap;
