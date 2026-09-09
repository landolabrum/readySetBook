import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './OverlayMap.scss';
/* Theme merged into component stylesheet */
import mapboxgl, {
  GeoJSONSource,
  LngLatLike,
  Map as MapboxMap,
  MapboxOptions,
  MapMouseEvent,
} from 'mapbox-gl';

/* Public types */
export type CourseMarker = {
  id?: string;
  lngLat: [number, number];
  onClick?: (e: MapMouseEvent) => void;
  label?: string;
  /**
   * Timestamp for this marker. Accepts Date, ms since epoch, or ISO string.
   * Will render as a concise relative label (e.g., "now", "2m", "1h", "Sep 3").
   */
  timestamp?: number | string | Date;
  /** Optional live speed (m/s) for label rendering */
  speedMps?: number;
  /** Also accept snake_case to be lenient with upstream payloads */
  speed_mps?: number;
};

export type MapCourse = {
  center?: [number, number] | null;
  zoom?: number | null;
  pitch?: number | null;
  markers: CourseMarker[];
};

export type CourseMapOptions = {
  lngLat?: [number, number];
  zoom?: number;
  pitch?: number;
  rpm?: number;
  loadingDelay?: number;
  tools?: any;
  styleUrl?: string;
  /**
   * When true, show detailed label lines (coord + time) under mph.
   * Defaults to false so only mph is rendered.
   */
  showDetailLabels?: boolean;
};

export type UiCourseMapProps = {
  course: MapCourse;
  options?: CourseMapOptions;
  aspect?: number; // default 1
  devicePixelRatio?: number;
  variant?: 'default' | 'blank' | string | null;
  /** Text shown as a corner pill when GPS is configured but not yet resolving. Null = hide. */
  gpsStatus?: string | null;
};

/* token */
const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
if (token) mapboxgl.accessToken = token;

/* ids */
function useIds() {
  const idRef = useRef<string>();
  if (!idRef.current) idRef.current = `course-${Math.random().toString(36).slice(2, 8)}`;
  const base = idRef.current;

  return useMemo(
    () => ({
      srcMarkers: `${base}-markers`,
      srcPath: `${base}-path`,
      layerMarkers: `${base}-markers-layer`,
      layerPath: `${base}-path-layer`,
      layerLabels: `${base}-labels-layer`, // mph + lat/lng + time overlay
    }),
    [base]
  );
}

/* time helpers */
function toMs(t?: number | string | Date): number | null {
  if (t == null) return null;
  if (typeof t === 'number') return t;
  if (t instanceof Date) return t.getTime();
  const n = Date.parse(t);
  return Number.isFinite(n) ? n : null;
}

function relTimeLabel(now: number, ts: number | null): string {
  if (!ts) return '';
  const diff = Math.max(0, now - ts);
  const s = Math.round(diff / 1000);
  if (s < 10) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d <= 7) return `${d}d`;
  const dt = new Date(ts);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* label helpers */
const toMph = (mps?: number) =>
  Number.isFinite(mps as number) ? Number(mps) * 2.23693629 : undefined;

function fmtCoordLabel(lat?: number, lon?: number) {
  if (!Number.isFinite(lat as number) || !Number.isFinite(lon as number)) return '';
  return `Lat ${lat!.toFixed(6)}  Lng ${lon!.toFixed(6)}`;
}

// Speeds below this (mph) are hidden — at a standstill GPS jitter otherwise
// renders a misleading crawling speed.
const MIN_DISPLAY_MPH = 5;

function fmtMphLabel(mps?: number) {
  // Display rules:
  // - If missing/invalid       -> '' (hide)
  // - If under MIN_DISPLAY_MPH  -> '' (hide)
  // - Else                     -> nearest integer mph
  const mph = toMph(mps);
  if (!Number.isFinite(mph as number)) return '';
  const v = Math.abs(mph as number);
  if (v < MIN_DISPLAY_MPH) return '';
  return `${Math.round(v)} mph`;
}

function getSpeedMps(m?: CourseMarker): number | undefined {
  if (!m) return undefined;
  if (Number.isFinite(m.speedMps as number)) return Number(m.speedMps);
  if (Number.isFinite(m.speed_mps as number)) return Number(m.speed_mps);
  return undefined;
}

/* geojson helpers */
function markersToFC(markers: CourseMarker[], now: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: markers.map((m, i) => {
      const ts = toMs(m.timestamp);
      // Allow both camelCase and snake_case for speed
      const speedMps = getSpeedMps(m);

      return {
        type: 'Feature',
        id: m.id ?? i,
        properties: {
          label: m.label ?? '',
          idx: i,
          ts: ts ?? undefined,
          timeLabel: relTimeLabel(now, ts),                     // ← 3rd label line
          mphLabel: fmtMphLabel(speedMps),                      // ← 1st label line
          coordLabel: fmtCoordLabel(m.lngLat?.[1], m.lngLat?.[0]), // ← 2nd label line
          lat: m.lngLat?.[1],
          lon: m.lngLat?.[0],
        },
        geometry: { type: 'Point', coordinates: [m.lngLat[0], m.lngLat[1]] },
      } as GeoJSON.Feature;
    }),
  };
}

function markersToLoopLine(markers: CourseMarker[]): GeoJSON.FeatureCollection {
  const coords = markers.map(m => [m.lngLat[0], m.lngLat[1]]);
  if (coords.length > 2) coords.push(coords[0]);

  return {
    type: 'FeatureCollection',
    features: coords.length
      ? [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      ]
      : [],
  };
}

/* component */
const OverlayCourseMap: React.FC<UiCourseMapProps> = ({
  course,
  options,
  aspect = 1,
  devicePixelRatio,
  variant = 'default',
  gpsStatus = null,
}) => {
  const ids = useIds();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const readyRef = useRef(false);
  const styleRef = useRef<string | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  // Surfaces a visible diagnostic instead of a silent gray box when the basemap
  // can't load — most commonly a missing or unauthorized Mapbox access token (401).
  const [mapError, setMapError] = useState<string | null>(
    !token ? 'Mapbox token missing' : null
  );

  // clock ticks every second to keep "last seen" fresh
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const styleUrl = options?.styleUrl ?? 'mapbox://styles/mb1-api-1/cmqxgkkyc001u01s7fes89eis';
  const fallbackCenter: [number, number] = options?.lngLat ?? [-80.1918, 25.7617];
  const fallbackZoom = options?.zoom ?? 15.6;
  const fallbackPitch = options?.pitch ?? 5;

  const center = (course?.center as [number, number] | null) ?? fallbackCenter;
  const zoom = (typeof course?.zoom === 'number' ? course.zoom : fallbackZoom) as number;
  const pitch = (typeof course?.pitch === 'number' ? course.pitch : fallbackPitch) as number;

  const markerFC = useMemo(() => markersToFC(course?.markers ?? [], clock), [course?.markers, clock]);
  const loopFC = useMemo(() => markersToLoopLine(course?.markers ?? []), [course?.markers]);

  // Track last position for single-marker heading estimation
  const lastSinglePosRef = useRef<{ lat: number; lon: number } | null>(null);

  function computeBearing(prev: { lat: number; lon: number }, next: { lat: number; lon: number }): number | null {
    // Formula: θ = atan2( sin(Δlon)*cos(lat2), cos(lat1)*sin(lat2) − sin(lat1)*cos(lat2)*cos(Δlon) )
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const lat1 = toRad(prev.lat);
    const lat2 = toRad(next.lat);
    const dLon = toRad(next.lon - prev.lon);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const brng = Math.atan2(y, x);
    if (!Number.isFinite(brng)) return null;
    const deg = (toDeg(brng) + 360) % 360; // 0..360
    return deg;
  }

  // Find the first marker that actually has speed
  const firstWithSpeed = useMemo(
    () => (course?.markers ?? []).find(m => Number.isFinite(getSpeedMps(m) as number)),
    [course?.markers]
  );

  // create map once
  // Track initialization attempt to allow re-init on context loss
  const initAttemptRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const opts: MapboxOptions = {
      container: el,
      style: styleUrl,
      center: center as LngLatLike,
      zoom,
      pitch,
      bearing: 0,                 // always point north
      attributionControl: false,
      interactive: false,
      preserveDrawingBuffer: true, // required for video capture / headless Chrome
      fadeDuration: 0,
      refreshExpiredTiles: true,   // keep tiles fresh for long-running streams
      trackResize: false,
    };
    // WebGL guard: some environments (VMs/servers) do not support it.
    try {
      const supported = (mapboxgl as any)?.supported?.({ failIfMajorPerformanceCaveat: false }) ?? true;
      if (!supported) {
        console.warn('[OverlayCourseMap] WebGL not supported; falling back to static map');
        setWebglFailed(true);
        return;
      }
    } catch { }

    let map: MapboxMap | null = null;
    try {
      map = new mapboxgl.Map(opts);
    } catch (err) {
      console.warn('[OverlayCourseMap] Failed to initialize WebGL; falling back to static map', err);
      setWebglFailed(true);
      return;
    }

    mapRef.current = map;
    styleRef.current = styleUrl;

    const addSourcesAndLayers = () => {
      try {
        // normalize camera: ensure north-up
        try { map.setBearing(0); } catch { }
        // sources
        if (!map.getSource(ids.srcMarkers)) {
          map.addSource(ids.srcMarkers, { type: 'geojson', data: markerFC });
        }
        if (!map.getSource(ids.srcPath)) {
          map.addSource(ids.srcPath, { type: 'geojson', data: loopFC });
        }

        // marker circles
        if (!map.getLayer(ids.layerMarkers)) {
          map.addLayer({
            id: ids.layerMarkers,
            type: 'circle',
            source: ids.srcMarkers,
            paint: {
              'circle-radius': 12,
              'circle-color': '#ff3300',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#001219',
            },
          });
        }

        // labels above marker: line1 = mph, line2 = lat/lng, line3 = time
        if (!map.getLayer(ids.layerLabels)) {
          const textField = (options?.showDetailLabels ? [
            'format',
            ['get', 'mphLabel'], { 'font-scale': 1.0 },
            '\n', {},
            ['get', 'coordLabel'], { 'font-scale': 0.85 },
            '\n', {},
            ['get', 'timeLabel'], { 'font-scale': 0.8 }
          ] : [
            'format',
            ['get', 'mphLabel'], { 'font-scale': 1.0 }
          ]) as any;
          map.addLayer({
            id: ids.layerLabels,
            type: 'symbol',
            source: ids.srcMarkers,
            layout: {
              // Multi-line formatted label (or mph only)
              'text-field': textField,
              'text-size': 16,
              'text-font': ['Inter Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-anchor': 'bottom',
              'text-offset': [0, -1.6],         // place above the circle
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
              'text-halo-blur': 0.5,
              'text-opacity': 0.98,
            },
          });
        }

        // path line
        if (!map.getLayer(ids.layerPath)) {
          map.addLayer({
            id: ids.layerPath,
            type: 'line',
            source: ids.srcPath,
            paint: {
              'line-width': 4,
              'line-color': '#00FF7F',
              'line-opacity': 0.9,
            },
            layout: { 'line-join': 'round', 'line-cap': 'round' },
          });
        }

        readyRef.current = true;
        // Resize after layers are added to ensure canvas matches container dimensions
        try { map.resize(); } catch { }
        try { map.triggerRepaint(); } catch { }
      } catch {
        // style may still be loading; styledata will fire again
      }
    };

    map.once('styledata', addSourcesAndLayers);

    // Final resize + repaint once all tiles and resources are fully loaded
    map.once('load', () => {
      try { map.resize(); } catch { }
      try { map.triggerRepaint(); } catch { }
    });

    // Catch map-level errors (e.g. WebGL compile failures, tile errors)
    map.on('error', (e: any) => {
      const msg = e?.error?.message ?? '';
      const status = e?.error?.status ?? e?.error?.statusCode;
      if (/webgl|context|shader/i.test(msg)) {
        console.warn('[OverlayCourseMap] Map WebGL error; falling back to static map', msg);
        setWebglFailed(true);
      } else if (status === 401 || status === 403 || /not authorized|invalid token|access token|forbidden/i.test(msg)) {
        // Basemap auth failure — tiles/style 401. Surface it instead of a blank gray box.
        console.error('[OverlayCourseMap] Mapbox authorization failed; check NEXT_PUBLIC_MAPBOX_TOKEN', msg || status);
        setMapError('Mapbox token unauthorized');
      }
    });

    // Handle WebGL context loss (common in headless Chrome / Docker)
    const canvas = map.getCanvas?.();
    let contextLostTimer: ReturnType<typeof setTimeout> | null = null;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('[OverlayCourseMap] WebGL context lost, will attempt recovery');
      // If context isn't restored within 5s, fall back to static map
      contextLostTimer = setTimeout(() => {
        console.warn('[OverlayCourseMap] WebGL context not restored; falling back to static map');
        setWebglFailed(true);
      }, 5000);
    };
    const handleContextRestored = () => {
      console.log('[OverlayCourseMap] WebGL context restored');
      if (contextLostTimer) { clearTimeout(contextLostTimer); contextLostTimer = null; }
      // Force map to re-render
      try {
        map.resize();
        map.triggerRepaint();
      } catch { }
    };
    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);
    }

    // Periodic keep-alive: force repaint every 30s to prevent context timeout
    const keepAlive = setInterval(() => {
      if (mapRef.current && readyRef.current) {
        try {
          mapRef.current.triggerRepaint();
        } catch { }
      }
    }, 30000);

    // Resize handling — debounced so rapid resizes during mount don't thrash the map
    let resizeRaf: number | null = null;
    const ro = new ResizeObserver(() => {
      if (!mapRef.current) return;
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        try { mapRef.current?.resize(); } catch { }
        if (readyRef.current) {
          try { mapRef.current?.triggerRepaint(); } catch { }
        }
      });
    });
    ro.observe(el);

    const prevDPR = (window as any).devicePixelRatio;
    if (devicePixelRatio && Number.isFinite(devicePixelRatio)) {
      (window as any).devicePixelRatio = devicePixelRatio;
      map.resize();
    }

    return () => {
      clearInterval(keepAlive);
      if (contextLostTimer) clearTimeout(contextLostTimer);
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
      ro.disconnect();
      if (devicePixelRatio && Number.isFinite(devicePixelRatio)) {
        (window as any).devicePixelRatio = prevDPR;
      }
      if (map) {
        try { map.stop?.(); } catch { }
        try { map.remove(); } catch { }
      }
      mapRef.current = null;
      readyRef.current = false;
      styleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // create once

  // react to styleUrl changes (re-style + re-add layers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (styleRef.current === styleUrl) return;

    readyRef.current = false;
    styleRef.current = styleUrl;
    map.setStyle(styleUrl);

    const readd = () => {
      try {
        // keep north-up on restyle
        try { map.setBearing(0); } catch { }
        const sm = map.getSource(ids.srcMarkers) as GeoJSONSource | undefined;
        if (!sm) map.addSource(ids.srcMarkers, { type: 'geojson', data: markerFC });
        else sm.setData(markerFC);

        const sp = map.getSource(ids.srcPath) as GeoJSONSource | undefined;
        if (!sp) map.addSource(ids.srcPath, { type: 'geojson', data: loopFC });
        else sp.setData(loopFC);

        if (!map.getLayer(ids.layerMarkers)) {
          map.addLayer({
            id: ids.layerMarkers,
            type: 'circle',
            source: ids.srcMarkers,
            paint: {
              'circle-radius': 12,
              'circle-color': '#ff3300',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#001219',
            },
          });
        }

        if (!map.getLayer(ids.layerLabels)) {
          const textField = (options?.showDetailLabels ? [
            'format',
            ['get', 'mphLabel'], { 'font-scale': 1.0 },
            '\n', {},
            ['get', 'coordLabel'], { 'font-scale': 0.85 },
            '\n', {},
            ['get', 'timeLabel'], { 'font-scale': 0.8 }
          ] : [
            'format',
            ['get', 'mphLabel'], { 'font-scale': 1.0 }
          ]) as any;
          map.addLayer({
            id: ids.layerLabels,
            type: 'symbol',
            source: ids.srcMarkers,
            layout: {
              'text-field': textField,
              'text-size': 16,
              'text-font': ['Inter Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-anchor': 'bottom',
              'text-offset': [0, -1.6],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
              'text-halo-blur': 0.5,
              'text-opacity': 0.98,
            },
          });
        }

        if (!map.getLayer(ids.layerPath)) {
          map.addLayer({
            id: ids.layerPath,
            type: 'line',
            source: ids.srcPath,
            paint: {
              'line-width': 4,
              'line-color': '#00FF7F',
              'line-opacity': 0.9,
            },
            layout: { 'line-join': 'round', 'line-cap': 'round' },
          });
        }

        readyRef.current = true;
      } catch {
        /* try again on next styledata if needed */
      }
    };

    map.once('styledata', readd);
    return () => {
      map.off('styledata', readd);
    };
  }, [styleUrl, ids.srcMarkers, ids.srcPath, ids.layerMarkers, ids.layerPath, ids.layerLabels, markerFC, loopFC]);

  // update camera (no style change)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Keep bearing as-is; orientation logic below will set north-up or heading as needed
    map.jumpTo({ center, zoom, pitch });
  }, [center, zoom, pitch]);

  // update sources only (data + labels)
  useEffect(() => {
    if (!readyRef.current || !mapRef.current) return;
    const map = mapRef.current;

    const srcMarkers = map.getSource(ids.srcMarkers) as GeoJSONSource | undefined;
    if (srcMarkers) srcMarkers.setData(markerFC);

    const srcPath = map.getSource(ids.srcPath) as GeoJSONSource | undefined;
    if (srcPath) srcPath.setData(loopFC);

    // Headless Chrome (video capture) may not auto-repaint after setData —
    // force a repaint to guarantee the circle layer appears on the captured frame.
    try { map.triggerRepaint(); } catch { }

    // Orientation logic: if exactly one marker, orient map bearing to movement direction.
    try {
      const markers = (course?.markers ?? []) as CourseMarker[];
      if (markers.length === 1 && markers[0]?.lngLat) {
        const [lon, lat] = markers[0].lngLat;
        const prev = lastSinglePosRef.current;
        if (prev && (prev.lat !== lat || prev.lon !== lon)) {
          const brng = computeBearing(prev, { lat, lon });
          if (brng != null && Number.isFinite(brng)) {
            // Smoothly orient towards heading
            map.easeTo({ bearing: brng, duration: 300, animate: true });
          }
        }
        lastSinglePosRef.current = { lat, lon };
      } else {
        // Default to north-up when not a single marker
        lastSinglePosRef.current = null;
        try { map.setBearing(0); } catch { }
      }
    } catch { }
  }, [markerFC, loopFC, ids.srcMarkers, ids.srcPath]);

  // update label formatting when showDetailLabels changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const textField = (options?.showDetailLabels ? [
      'format',
      ['get', 'mphLabel'], { 'font-scale': 1.0 },
      '\n', {},
      ['get', 'coordLabel'], { 'font-scale': 0.85 },
      '\n', {},
      ['get', 'timeLabel'], { 'font-scale': 0.8 }
    ] : [
      'format',
      ['get', 'mphLabel'], { 'font-scale': 1.0 }
    ]) as any;
    try {
      map.setLayoutProperty(ids.layerLabels, 'text-field', textField);
    } catch { }
  }, [options?.showDetailLabels, ids.layerLabels]);

  // Speed label for the corner pill — empty when below MIN_DISPLAY_MPH so the
  // pill is hidden rather than rendered as an empty box.
  const speedLabel = useMemo(
    () => fmtMphLabel(getSpeedMps(firstWithSpeed)),
    [firstWithSpeed]
  );

  // compute stale seconds (only show when > 5s)
  const staleSec: number | null = useMemo(() => {
    const m = firstWithSpeed as any;
    const ts = toMs(m?.timestamp);
    if (!ts) return null;
    const diff = Math.floor((clock - ts) / 1000);
    return diff > 5 ? diff : null;
  }, [firstWithSpeed, clock]);

  // Static map fallback URL for environments without WebGL (Docker / headless Chrome).
  // Encodes GPS markers as Mapbox pin overlays so the red dot survives the fallback.
  const staticMapUrl = useMemo(() => {
    if (!webglFailed || !token) return null;
    const styleId = styleUrl.replace('mapbox://styles/', '');
    const [cLng, cLat] = center;
    const w = 1280;
    const h = 1280;
    const pins = (course?.markers ?? [])
      .filter(m => Number.isFinite(m.lngLat?.[0]) && Number.isFinite(m.lngLat?.[1]))
      .map(m => `pin-l+ff3300(${m.lngLat[0].toFixed(5)},${m.lngLat[1].toFixed(5)})`)
      .join(',');
    const overlay = pins ? `${pins}/` : '';
    return `https://api.mapbox.com/styles/v1/${styleId}/static/${overlay}${cLng},${cLat},${zoom},0/${w}x${h}@2x?access_token=${token}`;
  }, [webglFailed, center, zoom, styleUrl, course?.markers]);

  return (
    <>

      <style jsx>{styles}</style>
      <div
        className={`overlay-map ${variant === 'blank' ? 'overlay-map--blank' : ''}`}
        data-aspect={aspect}
      >
        {speedLabel && (
          <div className='overlay-map__speed'>
            {speedLabel}
            {staleSec != null ? <span className='overlay-map__stale'>{`${staleSec}s`}</span> : null}
          </div>
        )}
        {gpsStatus && !firstWithSpeed && (
          <div className='overlay-map__gps-status'>{gpsStatus}</div>
        )}
        <div className="overlay-map__box">
          {mapError && (
            <div className="overlay-map__error" role="alert">{mapError}</div>
          )}
          {staticMapUrl ? (
            <img
              src={staticMapUrl}
              alt=""
              className="overlay-map__map overlay-map__map--static"
              draggable={false}
            />
          ) : (
            <div ref={containerRef} className="overlay-map__map" />
          )}
        </div>
      </div>
    </>
  );
};

export default OverlayCourseMap;
