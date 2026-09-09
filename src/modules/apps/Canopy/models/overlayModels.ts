/* -------------------------------------------------------------------------- */
/* overlayModels.ts – single source of truth for overlay model definitions    */
/* -------------------------------------------------------------------------- */

// Keep this file dependency-free to avoid circular imports. Any helper
// functions used here are self-contained.

type OverlayType =
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

type OverlayConfig = {
  label: string;
  defaultPos: { x: number; y: number };
  defaultPayload: () => any;
  mergeData: (a: any, b: any) => any; // a = existing, b = incoming
};

// Central allow/deny list for overlay types. Disabled types will be pruned by
// higher-level normalizers, but the configs remain here for legacy data
// inspection if needed.
export const DISABLED_OVERLAY_TYPES = new Set<OverlayType>();

const uniqBy = <T, K>(arr: T[], keyFn: (t: T) => K) => {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const it of arr) {
    const k = keyFn(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
};

const jsonStable = (v: unknown) => {
  try {
    return JSON.stringify(v, (_k, val) =>
      typeof val === 'bigint' ? String(val) : val
    );
  } catch {
    return '';
  }
};

/* Shared merge helper for camera/screen/encoder/pull overlay data */
const mergeShareData = (a: any, b: any) => {
  const numOr = (v: any, d: number) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : d;
  };
  return {
    kind: (b?.kind ?? a?.kind) ?? 'video',
    src: (b?.src ?? a?.src) ?? '',
    poster: (b?.poster ?? a?.poster) ?? '',
    autoplay: typeof b?.autoplay === 'boolean' ? b.autoplay : (a?.autoplay ?? true),
    loop: typeof b?.loop === 'boolean' ? b.loop : (a?.loop ?? false),
    muted: typeof b?.muted === 'boolean' ? b.muted : (a?.muted ?? true),
    playing: typeof b?.playing === 'boolean' ? b.playing : (a?.playing ?? true),
    width: numOr(b?.width, numOr(a?.width, 640)),
    height: numOr(b?.height, numOr(a?.height, 360)),
    pipelineSessionId: (b?.pipelineSessionId ?? a?.pipelineSessionId) ?? null,
    rtmpIngestUrl: (b?.rtmpIngestUrl ?? a?.rtmpIngestUrl) ?? '',
    streamKey: (b?.streamKey ?? a?.streamKey) ?? '',
    sourceContext: (b?.sourceContext ?? a?.sourceContext) ?? null,
  };
};

export const OVERLAY_MODELS: Record<OverlayType, OverlayConfig> = {
  camera: {
    label: 'Camera Share',
    defaultPos: { x: 50, y: 50 },
    defaultPayload: () => ({
      kind: 'video' as 'video',
      src: '' as string,
      poster: '' as string,
      autoplay: true as boolean,
      loop: false as boolean,
      muted: true as boolean,
      playing: true as boolean,
      width: 640 as number,
      height: 360 as number,
      pipelineSessionId: null as string | null,
      rtmpIngestUrl: '' as string,
      streamKey: '' as string,
    }),
    mergeData: mergeShareData,
  },
  screen: {
    label: 'Screen Share',
    defaultPos: { x: 50, y: 50 },
    defaultPayload: () => ({
      kind: 'video' as 'video',
      src: '' as string,
      poster: '' as string,
      autoplay: true as boolean,
      loop: false as boolean,
      muted: true as boolean,
      playing: true as boolean,
      width: 640 as number,
      height: 360 as number,
      pipelineSessionId: null as string | null,
      rtmpIngestUrl: '' as string,
      streamKey: '' as string,
    }),
    mergeData: mergeShareData,
  },
  encoder: {
    label: 'Encoder Push',
    defaultPos: { x: 50, y: 50 },
    defaultPayload: () => ({
      kind: 'video' as 'video',
      src: '' as string,
      poster: '' as string,
      autoplay: true as boolean,
      loop: false as boolean,
      muted: true as boolean,
      playing: true as boolean,
      width: 640 as number,
      height: 360 as number,
      pipelineSessionId: null as string | null,
      rtmpIngestUrl: '' as string,
      streamKey: '' as string,
    }),
    mergeData: mergeShareData,
  },
  pull: {
    label: 'Pull Stream',
    defaultPos: { x: 50, y: 50 },
    defaultPayload: () => ({
      kind: 'video' as 'video',
      src: '' as string,
      poster: '' as string,
      autoplay: true as boolean,
      loop: false as boolean,
      muted: true as boolean,
      playing: true as boolean,
      width: 640 as number,
      height: 360 as number,
      pipelineSessionId: null as string | null,
      rtmpIngestUrl: '' as string,
      streamKey: '' as string,
      sourceUrl: '' as string,
    }),
    mergeData: (a, b) => ({
      ...mergeShareData(a, b),
      sourceUrl: (b?.sourceUrl ?? a?.sourceUrl) ?? '',
    }),
  },
  media: {
    label: 'Media',
    // Center-ish by default
    defaultPos: { x: 50, y: 50 },
    // Default dimensions approx 16:9 if not set
    defaultPayload: () => ({
      kind: 'video' as 'video' | 'iframe',
      src: '' as string,
      poster: '' as string,
      autoplay: true as boolean,
      loop: false as boolean,
      muted: false as boolean,
      playing: true as boolean,
      urls: [] as string[],
      segments: [] as any[],
      duration: 30 as number,
      preload: 0 as number,
      width: 1920 as number,
      height: 1080 as number,
      volume: 1 as number,
      aspectPreset: '16:9' as string,
      rtspFps: 12 as number,
      rtspQuality: 85 as number,
      rtspResolution: '' as string,
      multiviewColumns: 0 as number,
      multiviewObjectFit: 'contain' as string,
      multiviewShowLabels: false as boolean,
    }),
    mergeData: (a, b) => {
      const urls = Array.isArray(b?.urls)
        ? b.urls.map((u: any) => String(u || '').trim()).filter(Boolean)
        : Array.isArray(a?.urls)
          ? a.urls.map((u: any) => String(u || '').trim()).filter(Boolean)
          : [];

      const numOr = (v: any, d: number) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : d;
      };

      // Preserve per-segment timeline data through merges
      const segments = Array.isArray(b?.segments) && b.segments.length
        ? b.segments
        : Array.isArray(a?.segments) && a.segments.length
          ? a.segments
          : [];

      // Segments are the source of truth for pixel dims; the media form only
      // edits data.segments.N.width/height, so mirror the first segment into
      // the legacy top-level width/height instead of carrying stale defaults.
      const seg0 = segments[0] ?? null;

      return {
        kind: (b?.kind ?? a?.kind) ?? 'video',
        src: (b?.src ?? a?.src ?? urls[0] ?? ''),
        poster: (b?.poster ?? a?.poster) ?? '',
        autoplay: typeof b?.autoplay === 'boolean' ? b.autoplay : (a?.autoplay ?? true),
        loop: typeof b?.loop === 'boolean' ? b.loop : (a?.loop ?? false),
        muted: typeof b?.muted === 'boolean' ? b.muted : (a?.muted ?? false),
        playing: typeof b?.playing === 'boolean' ? b.playing : (a?.playing ?? true),
        urls,
        segments,
        duration: numOr(b?.duration, numOr(a?.duration, 30)),
        preload: numOr(b?.preload, numOr(a?.preload, 0)),
        width: numOr(seg0?.width, numOr(b?.width, numOr(a?.width, 1920))),
        height: numOr(seg0?.height, numOr(b?.height, numOr(a?.height, 1080))),
        volume: numOr(b?.volume, numOr(a?.volume, 1)),
        aspectPreset: (b?.aspectPreset ?? a?.aspectPreset) ?? '16:9',
        rtspFps: numOr(b?.rtspFps, numOr(a?.rtspFps, 12)),
        rtspQuality: numOr(b?.rtspQuality, numOr(a?.rtspQuality, 85)),
        rtspResolution: (b?.rtspResolution ?? a?.rtspResolution) ?? '',
        multiviewColumns: numOr(b?.multiviewColumns, numOr(a?.multiviewColumns, 0)),
        multiviewObjectFit: (b?.multiviewObjectFit ?? a?.multiviewObjectFit) ?? 'contain',
        multiviewShowLabels: typeof b?.multiviewShowLabels === 'boolean' ? b.multiviewShowLabels : (a?.multiviewShowLabels ?? false),
      };
    },
  },
  scoreboard: {
    label: 'Scoreboard',
    defaultPos: { x: 1, y: 2.5 },
    defaultPayload: () => ({ teams: [] }),
    mergeData: (a, b) => {
      const A = a?.teams ?? [];
      const B = b?.teams ?? [];
      const key = (t: any) => String(t?.id ?? t?.name ?? '');
      return { teams: uniqBy([...A, ...B], key) };
    },
  },
  ticker: {
    label: 'Ticker',
    defaultPos: { x: 0, y: 100 },
    defaultPayload: () => ({ items: [], width_pct: 100 as number, height_pct: 5 as number }),
    mergeData: (a, b) => {
      const A = a?.items ?? [];
      const B = b?.items ?? [];
      const key = (x: any) => jsonStable(x);
      const numOr = (v: any, d: number) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : d;
      };
      return {
        items: uniqBy([...A, ...B], key),
        width_pct: numOr(b?.width_pct, numOr(a?.width_pct, 100)),
        height_pct: numOr(b?.height_pct, numOr(a?.height_pct, 5)),
      };
    },
  },
  lapcounter: {
    label: 'Lap Counter',
    defaultPos: { x: 93, y: 2.5 },
    defaultPayload: () => ({
      currentLap: 1 as number,
      totalLaps: 1 as number | null,
      items: [] as string[],
    }),
    mergeData: (a, b) => {
      const A = Array.isArray(a?.items) ? a.items : [];
      const B = Array.isArray(b?.items) ? b.items : [];
      const key = (x: any) => jsonStable(x);

      const cur = typeof b?.currentLap === 'number' ? b.currentLap : a?.currentLap;
      const tot = typeof b?.totalLaps === 'number' ? b.totalLaps : a?.totalLaps;

      const currentLap = Number.isFinite(cur as number) ? Number(cur) : 1;
      const totalLaps =
        tot == null
          ? null
          : Number.isFinite(tot as number)
            ? Number(tot)
            : null;

      return {
        currentLap,
        totalLaps,
        items: uniqBy([...A, ...B], key),
      };
    },
  },
  map: {
    label: 'Map',
    defaultPos: { x: 100, y: 100 },
    defaultPayload: () => ({
      markers: [],
      lngLat: null as [number, number] | null,
      lat: null as number | null,
      lng: null as number | null,
      address: null as any,
      zoom: null as number | null,
      pitch: null as number | null,
      rpm: null as number | null,
      loadingDelay: null as number | null,
      tools: null as any,
      manualCenter: false as boolean,
      opacity: 1 as number,
      src: '' as string | null,
      team_numbers: [] as Array<string | number>,
      userId: null as string | null,
      gps_source: null as any,
      gps_sources: null as any,
    }),
    mergeData: (a, b) => {
      const A = a?.markers ?? [];
      const B = b?.markers ?? [];
      const key = (m: any) => jsonStable(m);

      const tA: string[] = Array.isArray(a?.team_numbers)
        ? a.team_numbers.map((x: any) => String(x).trim()).filter(Boolean)
        : [];
      const tB: string[] = Array.isArray(b?.team_numbers)
        ? b.team_numbers.map((x: any) => String(x).trim()).filter(Boolean)
        : [];
      const tSet = new Set<string>([...tA, ...tB]);
      const team_numbers = Array.from(tSet);

      const rawUserId = (b?.userId ?? b?.user_id ?? a?.userId ?? a?.user_id ?? '') as string;
      const userId = (() => {
        const val = typeof rawUserId === 'string' ? rawUserId.trim() : String(rawUserId ?? '').trim();
        return val || null;
      })();

      return {
        lngLat: (b?.lngLat ?? a?.lngLat) ?? null,
        lat: (b?.lat ?? a?.lat) ?? null,
        lng: (b?.lng ?? a?.lng) ?? null,
        address: (b?.address ?? a?.address) ?? null,
        zoom: (b?.zoom ?? a?.zoom) ?? null,
        pitch: (b?.pitch ?? a?.pitch) ?? null,
        rpm: (b?.rpm ?? a?.rpm) ?? null,
        loadingDelay: (b?.loadingDelay ?? a?.loadingDelay) ?? null,
        manualCenter:
          (typeof b?.manualCenter === 'boolean' ? b?.manualCenter : a?.manualCenter) ??
          false,
        opacity: (typeof b?.opacity === 'number' ? b?.opacity : a?.opacity) ?? 1,
        src: (b?.src ?? a?.src) ?? null,
        tools:
          typeof b?.tools === 'object' && b?.tools
            ? { ...(a?.tools || {}), ...(b?.tools || {}) }
            : a?.tools ?? b?.tools ?? null,
        markers: uniqBy([...A, ...B], key),
        team_numbers,
        userId,
        gps_source: (b?.gps_source ?? a?.gps_source) ?? null,
        gps_sources: (() => {
          if (Array.isArray(b?.gps_sources)) return b.gps_sources;
          if (Array.isArray(a?.gps_sources)) return a.gps_sources;
          return null;
        })(),
      };
    },
  },
  hud: {
    label: 'HUD',
    defaultPos: { x: 92, y: 8 },
    defaultPayload: () => ({
      team_number: null as string | number | null,
      lat: null as number | null,
      lon: null as number | null,
      timestamp: null as string | null,
      gps_source: null as any,
    }),
    mergeData: (a, b) => ({
      team_number: (b?.team_number ?? a?.team_number) ?? null,
      lat: (b?.lat ?? a?.lat) ?? null,
      lon: (b?.lon ?? a?.lon) ?? null,
      timestamp: (b?.timestamp ?? a?.timestamp) ?? null,
      gps_source: (b?.gps_source ?? a?.gps_source) ?? null,
    }),
  },
  weather: {
    label: 'Weather',
    defaultPos: { x: 85, y: 2.5 },
    defaultPayload: () => ({
      team_number: null as string | number | null,
      lat: null as number | null,
      lng: null as number | null,
      address: null as any,
      surfMaxBeachSearchKm: 60 as number,
      surfForecastHours: 12 as number,
      surfUnits: 'imperial' as 'imperial' | 'metric',
      gps_source: null as any,
    }),
    mergeData: (a, b) => ({
      team_number: (b?.team_number ?? a?.team_number) ?? null,
      lat: (b?.lat ?? a?.lat) ?? null,
      lng: (b?.lng ?? a?.lng) ?? null,
      address: b?.address ?? a?.address ?? null,
      surfMaxBeachSearchKm: (() => {
        const n = Number(b?.surfMaxBeachSearchKm ?? a?.surfMaxBeachSearchKm);
        return Number.isFinite(n) ? n : 60;
      })(),
      surfForecastHours: (() => {
        const n = Number(b?.surfForecastHours ?? a?.surfForecastHours);
        return Number.isFinite(n) ? n : 12;
      })(),
      surfUnits: (b?.surfUnits ?? a?.surfUnits) === 'metric' ? 'metric' : 'imperial',
      gps_source: (b?.gps_source ?? a?.gps_source) ?? null,
    }),
  },
  chat: {
    label: 'Chat',
    defaultPos: { x: 75, y: 25 },
    defaultPayload: () => ({
      platform: 'twitch' as const,
      channel: '' as string,
      maxMessages: 50 as number,
      showBadges: true as boolean,
      showColors: true as boolean,
    }),
    mergeData: (a, b) => {
      const numOr = (v: any, d: number) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : d;
      };
      return {
        platform: 'twitch',
        channel: (b?.channel ?? a?.channel) ?? '',
        maxMessages: numOr(b?.maxMessages, numOr(a?.maxMessages, 50)),
        showBadges: typeof b?.showBadges === 'boolean' ? b.showBadges : (a?.showBadges ?? true),
        showColors: typeof b?.showColors === 'boolean' ? b.showColors : (a?.showColors ?? true),
      };
    },
  },
  card: {
    label: 'Card',
    defaultPos: { x: 50, y: 14 },
    defaultPayload: () => ({
      headline: 'Stat Card' as string,
      subheadline: '' as string,
      columns: 3 as number,
      gap: 10 as number,
      padding: 12 as number,
      minItemHeight: 90 as number,
      background: '#0b1017dd' as string,
      itemBackground: '#121c2bdd' as string,
      textColor: '#f5f8ff' as string,
      items: [
        {
          id: 'card-item-1' as string,
          title: 'Headline' as string,
          value: 'Ready' as string,
          subtitle: '' as string,
          description: '' as string,
          imageUrl: '' as string,
          background: '' as string,
          textColor: '' as string,
          accent: '' as string,
          colSpan: 1 as number,
          rowSpan: 1 as number,
          binding: {
            source: 'static' as string,
            mode: 'aggregate' as string,
            key: '' as string,
            selector: {
              type: '' as string,
              value: '' as string,
            },
            fallback: '' as string,
            prefix: '' as string,
            suffix: '' as string,
            decimals: 0 as number,
          },
        },
      ] as any[],
      eventInfo: {} as any,
    }),
    mergeData: (a, b) => {
      const numOr = (v: any, d: number) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : d;
      };

      const aItems = Array.isArray(a?.items) ? a.items : [];
      const bItems = Array.isArray(b?.items) ? b.items : [];
      const items = bItems.length ? bItems : aItems;

      return {
        headline: (b?.headline ?? a?.headline) ?? 'Stat Card',
        subheadline: (b?.subheadline ?? a?.subheadline) ?? '',
        columns: numOr(b?.columns, numOr(a?.columns, 3)),
        gap: numOr(b?.gap, numOr(a?.gap, 10)),
        padding: numOr(b?.padding, numOr(a?.padding, 12)),
        minItemHeight: numOr(b?.minItemHeight, numOr(a?.minItemHeight, 90)),
        background: (b?.background ?? a?.background) ?? '#0b1017dd',
        itemBackground: (b?.itemBackground ?? a?.itemBackground) ?? '#121c2bdd',
        textColor: (b?.textColor ?? a?.textColor) ?? '#f5f8ff',
        items,
        eventInfo:
          typeof b?.eventInfo === 'object' && b?.eventInfo
            ? { ...(a?.eventInfo || {}), ...(b?.eventInfo || {}) }
            : a?.eventInfo ?? b?.eventInfo ?? {},
      };
    },
  },
};

export type { OverlayType, OverlayConfig };
