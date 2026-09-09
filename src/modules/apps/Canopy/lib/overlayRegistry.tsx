import React from "react";
import OverlayCourseMap from "../receiver/overlays/OverlayMap/OverlayMap";
import OverlayHud from "../receiver/overlays/OverlayHud/OverlayHud";
import OverlayLapCounter from "../receiver/overlays/OverlayLapCounter/OverlayLapCounter";
import OverlayMedia from "../receiver/overlays/OverlayMedia/controller/OverlayMedia";
import ShareMedia from "../receiver/overlays/ShareMedia";
import { resolveShareSource } from "./share/resolveShareSource";
import OverlayScoreBoard from "../receiver/overlays/OverlayScoreBoard/OverlayScoreBoard";
import OverlayTicker from "../receiver/overlays/OverlayTicker/OverlayTicker";
import OverlayWeather from "../receiver/overlays/OverlayWeather/controller/OverlayWeather";
import OverlayCard from "../receiver/overlays/OverlayCard/OverlayCard";
import OverlayChat from "../receiver/overlays/OverlayChat/OverlayChat";
import type { CanonOverlay, OverlayType } from "../models/canopyOverlayTypes";
import { normalizeSegments } from "../models/canopyOverlayTypes";
import { DISABLED_OVERLAY_TYPES, OVERLAY_MODELS } from "../models/overlayModels";
import type { SurfOverlayConfig } from "../receiver/overlays/OverlayWeather/overlayWeatherUtils";
import type { Team } from "../receiver/engine/types";
import { coerceTeams } from "../receiver/engine/utils";
import useSingleUserLiveLocation from "../hooks/useSingleUserLiveLocation";
import { resolveGpsSource, type ResolveCtx } from "@Canopy/lib/teamGps";
import type { GpsSource, GpsState } from "@Canopy/models/overlay/gpsSource";

export type OverlayRenderContext = {
    gps: { map: Map<string, string>; get: (vehicleNumber?: string | number) => string | undefined };
    enrichTeams: (teams?: Team[] | null) => Team[];
    lastGpsSamplesRef: React.MutableRefObject<Map<string, { lat: number; lon: number; timestamp: number }>>;
    lastSpeedRef: React.MutableRefObject<Map<string, number>>;
    eventMeta?: Record<string, any> | null;
    source?: string;
    localPipelineStream?: MediaStream | null;
    pipelineSessionId?: string;
    pipelineHlsUrl?: string;
    getStreamForSession?: (sessionId: string | null | undefined) => MediaStream | null;
};

const MPH_PER_MPS = 2.23693629;

const buildTeamMarker = (
    id: string,
    ctx: OverlayRenderContext,
): { id: string; lngLat: [number, number]; label: string; speed_mps?: number; timestamp: number } | null => {
    const coord = ctx.gps.get(id);
    if (!coord) return null;
    const parts = String(coord).split(",").map((s) => s.trim());
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    // Device-reported speed (m/s) — present when IC2/GPS fix includes speed_mps
    const deviceSpeedMps = parts[2] != null && parts[2] !== ""
        ? Number(parts[2])
        : undefined;

    const now = Date.now();
    let derivedSpeedMph: number | undefined;

    const last = ctx.lastGpsSamplesRef.current.get(id);
    const moved = !last || last.lat !== lat || last.lon !== lon;
    if (moved) {
        if (last) {
            const dlat = (lat - last.lat) * Math.PI / 180;
            const dlon = (lon - last.lon) * Math.PI / 180;
            const lat1 = last.lat * Math.PI / 180;
            const lat2 = lat * Math.PI / 180;
            const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
            const miles = 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(a)));
            const hours = (now - last.timestamp) / 3600000;
            if (hours > 0) derivedSpeedMph = miles / hours;
        }
        ctx.lastGpsSamplesRef.current.set(id, { lat, lon, timestamp: now });
    }

    // Prefer device-reported speed; fall back to derived only if unavailable
    const speed_mps = (Number.isFinite(deviceSpeedMps as number) && (deviceSpeedMps as number) >= 0)
        ? deviceSpeedMps as number
        : (Number.isFinite(derivedSpeedMph as number) ? Number(derivedSpeedMph) / MPH_PER_MPS : undefined);

    if (speed_mps != null) ctx.lastSpeedRef.current.set(id, speed_mps * MPH_PER_MPS);

    return { id, lngLat: [lon, lat], label: `#${id}`, speed_mps, timestamp: now };
};

const MapOverlayRenderer: React.FC<{ overlay: CanonOverlay; ctx: OverlayRenderContext }> = ({ overlay, ctx }) => {
    const data = ((overlay as any)?.data ?? {}) as any;

    // Guardian tracking — legacy single-user path (gps_sources guardian multi is deferred)
    const trackedUserId = (() => {
        const raw = data?.userId ?? data?.user_id;
        if (!raw) return "";
        return String(raw).trim();
    })();
    const { fix: trackedFix } = useSingleUserLiveLocation(trackedUserId || undefined);

    // Build GPS markers: prefer gps_sources (new), fall back to team_numbers (legacy)
    const gpsSources: any[] = Array.isArray(data?.gps_sources) ? data.gps_sources : [];
    const gpsMarkers = (() => {
        if (gpsSources.length > 0) {
            return gpsSources
                .filter((s: any) => s?.kind === 'team' && s?.team_number)
                .map((s: any) => buildTeamMarker(String(s.team_number), ctx))
                .filter(Boolean) as ReturnType<typeof buildTeamMarker>[];
        }
        // Legacy: team_numbers array
        const teamNumbers = Array.isArray(data?.team_numbers) ? (data.team_numbers as any[]) : [];
        return teamNumbers
            .map((n) => buildTeamMarker(String(n), ctx))
            .filter(Boolean) as ReturnType<typeof buildTeamMarker>[];
    })();

    const manualMarkers = Array.isArray(data?.markers) ? data.markers : [];

    const trackedMarker = (() => {
        if (!trackedUserId || !trackedFix) return null;
        const lat = trackedFix.latitude;
        const lon = trackedFix.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const speed_mps = Number.isFinite(trackedFix.speedMph as number)
            ? Number(trackedFix.speedMph) / MPH_PER_MPS
            : undefined;
        return {
            id: `user-${trackedUserId}`,
            lngLat: [lon, lat] as [number, number],
            label: trackedUserId,
            speed_mps,
            timestamp: trackedFix.timestamp,
        };
    })();

    const markers = [...manualMarkers, ...gpsMarkers, ...(trackedMarker ? [trackedMarker] : [])];

    // eventMeta fallback so the map shows the right region when GPS is pending
    const eventCenter: [number, number] | undefined = (() => {
        const lat = Number(ctx.eventMeta?.lat ?? ctx.eventMeta?.latitude);
        const lng = Number(ctx.eventMeta?.lng ?? ctx.eventMeta?.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? [lng, lat] : undefined;
    })();

    const center =
        data?.manualCenter && Number.isFinite(data?.lng) && Number.isFinite(data?.lat)
            ? ([Number(data.lng), Number(data.lat)] as [number, number])
            : Array.isArray(data?.lngLat)
                ? (data.lngLat as [number, number])
                : trackedMarker?.lngLat
                ?? gpsMarkers[0]?.lngLat
                ?? manualMarkers[0]?.lngLat
                ?? eventCenter
                ?? undefined;

    // GPS status label — shown when sources are configured but none have resolved yet
    const wantedTeamNums = gpsSources.length > 0
        ? gpsSources.filter((s: any) => s?.kind === 'team').map((s: any) => String(s.team_number))
        : Array.isArray(data?.team_numbers) ? (data.team_numbers as any[]).map(String) : [];
    const gpsStatus = wantedTeamNums.length > 0 && gpsMarkers.length === 0 && !trackedMarker
        ? `GPS WAITING  #${wantedTeamNums.join(', #')}`
        : null;

    const showDetailLabels = Boolean(data?.showCoordLabels || data?.show_coord_labels || data?.show_latlng || data?.showDetails);

    return (
        <OverlayCourseMap
            course={{
                center: center ?? undefined,
                zoom: typeof data?.zoom === "number" ? data.zoom : undefined,
                pitch: typeof data?.pitch === "number" ? data.pitch : 45,
                markers,
            }}
            options={{ showDetailLabels }}
            gpsStatus={gpsStatus}
            variant={(overlay as any)?.variant ?? "default"}
        />
    );
};

const normalizeType = (value: any): OverlayType | undefined => {
    const raw = String(value ?? "").toLowerCase();
    if (!raw) return undefined;
    const aliasMap: Record<string, OverlayType> = {
        score: "scoreboard",
        laps: "lapcounter",
        gps: "map",
        device: "encoder",
        share: "encoder",
        camera: "camera",
        screen: "screen",
        encoder: "encoder",
        rtmp: "encoder",
        pull: "pull",
        card: "card",
        chat: "chat",
    };
    const alias = aliasMap[raw];
    const candidate = (alias ?? raw) as OverlayType;
    if (DISABLED_OVERLAY_TYPES.has(candidate)) return undefined;
    if ((OVERLAY_MODELS as any)[candidate]) return candidate;
    return undefined;
};

type OverlayRenderer = (overlay: CanonOverlay, ctx: OverlayRenderContext) => React.ReactNode;

const parseLat = (v: any): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

const WeatherOverlayRenderer: React.FC<{ overlay: CanonOverlay; ctx: OverlayRenderContext }> = ({ overlay, ctx }) => {
    const data = ((overlay as any)?.data ?? {}) as any;
    const variant = (overlay as any)?.variant ?? "default";

    const gpsSource: GpsSource | null = data?.gps_source ?? null;
    const guardianUserId = gpsSource?.kind === "guardian" ? gpsSource.user_id : undefined;
    const { fix: guardianFix } = useSingleUserLiveLocation(guardianUserId || undefined);

    let lat: number | null;
    let lng: number | null;
    let gpsState: GpsState;

    if (gpsSource) {
        const resolveCtx: ResolveCtx = { gps: ctx.gps, lastGpsSamplesRef: ctx.lastGpsSamplesRef, guardianFix: guardianFix ?? null };
        const resolved = resolveGpsSource(gpsSource, resolveCtx);
        lat = resolved.lat;
        lng = resolved.lng;
        gpsState = resolved.gpsState;
    } else {
        // Legacy path — team_number takes priority over manual lat/lng
        lat = parseLat(data?.lat);
        lng = parseLat(data?.lng);
        gpsState = { kind: "none" };
        const teamNumber = data?.team_number != null ? String(data.team_number).trim() : "";
        if (teamNumber) {
            const coord = ctx.gps.get(teamNumber);
            if (coord) {
                const [latS, lonS] = String(coord).split(",").map((s) => s.trim());
                const liveLat = Number(latS);
                const liveLon = Number(lonS);
                if (Number.isFinite(liveLat) && Number.isFinite(liveLon)) {
                    lat = liveLat;
                    lng = liveLon;
                    const prev = ctx.lastGpsSamplesRef.current.get(teamNumber);
                    const now = Date.now();
                    const movedOrFirst = !prev || prev.lat !== liveLat || prev.lon !== liveLon;
                    const stampTs = movedOrFirst ? now : prev!.timestamp;
                    if (movedOrFirst) ctx.lastGpsSamplesRef.current.set(teamNumber, { lat: liveLat, lon: liveLon, timestamp: now });
                    const ageSec = Math.max(0, Math.round((now - stampTs) / 1000));
                    gpsState = ageSec > 60
                        ? { kind: "stale", sourceKind: "team", label: `#${teamNumber}`, ageSec }
                        : { kind: "live" };
                } else {
                    gpsState = { kind: "error", sourceKind: "team", label: `#${teamNumber}` };
                }
            } else {
                gpsState = { kind: "pending", sourceKind: "team", label: `#${teamNumber}` };
            }
        }
    }

    const address = gpsSource?.kind === "manual"
        ? (gpsSource.address ?? null)
        : (!gpsSource && !data?.team_number ? (data?.address ?? null) : null);
    const addressHint = address ? {
        city: address.city || address.town || address.locality || "",
        state: address.state || address.administrative_area_level_1 || "",
        country: address.country || "",
    } : null;

    const surfConfig: SurfOverlayConfig = {
        maxBeachSearchKm: Number.isFinite(Number(data?.surfMaxBeachSearchKm)) ? Number(data.surfMaxBeachSearchKm) : undefined,
        forecastHours: Number.isFinite(Number(data?.surfForecastHours)) ? Number(data.surfForecastHours) : undefined,
        units: data?.surfUnits === "metric" ? "metric" : "imperial",
    };

    return (
        <OverlayWeather
            lat={lat}
            lng={lng}
            variant={variant}
            title={overlay.title as any}
            description={(overlay as any)?.description as any}
            addressHint={addressHint}
            surfConfig={surfConfig}
            gpsState={gpsState}
        />
    );
};

const HudOverlayRenderer: React.FC<{ overlay: CanonOverlay; ctx: OverlayRenderContext }> = ({ overlay, ctx }) => {
    const data = ((overlay as any)?.data ?? {}) as any;

    const gpsSource: GpsSource | null = data?.gps_source ?? null;
    const guardianUserId = gpsSource?.kind === "guardian" ? gpsSource.user_id : undefined;
    const { fix: guardianFix } = useSingleUserLiveLocation(guardianUserId || undefined);

    let lat: number | null = null;
    let lng: number | null = null;

    if (gpsSource) {
        const resolveCtx: ResolveCtx = { gps: ctx.gps, lastGpsSamplesRef: ctx.lastGpsSamplesRef, guardianFix: guardianFix ?? null };
        const resolved = resolveGpsSource(gpsSource, resolveCtx);
        lat = resolved.lat;
        lng = resolved.lng;
    } else {
        // Legacy path
        const requestedVeh = data?.team_number ? String(data.team_number) : undefined;
        const coords = (requestedVeh && ctx.gps.get(requestedVeh)) || (Array.from(ctx.gps.map.values())[0] ?? "");
        const [latS, lonS] = String(coords).split(",").map((s) => s.trim());
        if (latS && lonS) { lat = parseFloat(latS); lng = parseFloat(lonS); }
    }

    const gpsData = lat != null && lng != null
        ? { lat, lon: lng, timestamp: new Date().toISOString() }
        : undefined;

    return <OverlayHud gpsData={gpsData} />;
};

/* Shared renderer for camera/screen/encoder/pull overlay types.
   resolveShareSource picks the playback input (live stream, HLS URL, or
   waiting state); <ShareMedia> renders the corresponding video / placeholder. */
const renderShareOverlay: OverlayRenderer = (overlay, ctx) => {
    const data = ((overlay as any)?.data ?? {}) as any;
    const variantRaw = (overlay as any)?.variant ?? "default";
    const variant = variantRaw === "carousel" ? "default" : variantRaw;

    const resolved = resolveShareSource(overlay, {
        source: ctx?.source,
        localPipelineStream: ctx?.localPipelineStream,
        pipelineSessionId: ctx?.pipelineSessionId,
        pipelineHlsUrl: ctx?.pipelineHlsUrl,
        getStreamForSession: ctx?.getStreamForSession,
    });

    if (typeof window !== 'undefined' && (window as any).__DEBUG_SHARE_OVERLAY) {
        console.log('[Share Overlay] resolved:', {
            overlayId: (overlay as any)?.id,
            overlayType: (overlay as any)?.type,
            ctxSource: ctx?.source,
            ctxPipelineSessionId: ctx?.pipelineSessionId,
            ctxPipelineHlsUrl: ctx?.pipelineHlsUrl,
            resolved,
        });
    }

    return (
        <ShareMedia
            overlayId={(overlay as any)?.id}
            resolved={resolved}
            title={overlay.title as any}
            description={overlay.description as any}
            variant={variant}
            autoplay={typeof data?.autoplay === "boolean" ? data.autoplay : true}
            muted={typeof data?.muted === "boolean" ? data.muted : true}
            playing={typeof data?.playing === "boolean" ? data.playing : true}
            volume={typeof data?.volume === "number" ? data.volume : 1}
            poster={data?.poster ?? ""}
        />
    );
};

const overlayRenderers: Partial<Record<OverlayType, OverlayRenderer>> = {
    scoreboard: (overlay, ctx) => {
        const variant = (overlay as any)?.variant ?? "default";
        const rawTeams = coerceTeams((overlay as any)?.data?.teams);
        const teams = ctx.enrichTeams(rawTeams);
        return (
            <OverlayScoreBoard
                title={overlay.title as any}
                subTitle={overlay.description as any}
                data={{ teams: teams as any }}
                fullScreen={variant === "fullscreen"}
                variant={variant}
            />
        );
    },
    ticker: (overlay) => {
        const data = ((overlay as any)?.data ?? {}) as any;
        const items = Array.isArray(data?.items) ? data.items : [overlay?.title ?? ""];
        const durationSec = Number.isFinite(data?.duration) ? Number(data.duration) : undefined;
        const speed = Number.isFinite(data?.speed) ? Number(data.speed) : undefined;
        const direction = String(data?.direction || "ltr").toLowerCase() === "rtl" ? "rtl" : "ltr";
        const fontSize = data?.fontSize ?? data?.font_size;
        return (
            <OverlayTicker
                items={items as any}
                durationSec={durationSec}
                speedPxPerSec={speed}
                direction={direction as any}
                fontSize={fontSize as any}
                title={overlay.title as any}
                subTitle={(overlay as any)?.description || (data?.subtitle ?? data?.subTitle) || undefined}
                variant={(overlay as any)?.variant ?? "default"}
            />
        );
    },
    map: (overlay, ctx) => <MapOverlayRenderer overlay={overlay} ctx={ctx} />,
    hud: (overlay, ctx) => <HudOverlayRenderer overlay={overlay} ctx={ctx} />,
    lapcounter: (overlay) => <OverlayLapCounter current={overlay as any} />,
    media: (overlay) => {
        const data = ((overlay as any)?.data ?? {}) as any;
        const variantRaw = (overlay as any)?.variant ?? "default";
        const variant = variantRaw === "carousel" ? "default" : variantRaw;

        // New per-segment data — normalizeSegments handles legacy data.urls fallback
        const segments = normalizeSegments(data);

        // Legacy flat arrays kept for backwards compat
        const urls = segments.map((s: any) => s.url).filter(Boolean);

        // Use first segment's dimension/kind as the overall default (receiver
        // still accepts top-level width/height for the container).
        const first = segments[0] ?? {};
        const duration = typeof first.duration === "number" ? first.duration : (typeof data?.duration === "number" ? data.duration : undefined);
        const preload = typeof first.preload === "number" ? first.preload : (typeof data?.preload === "number" ? data.preload : undefined);
        const width = typeof first.width === "number" ? first.width : (typeof data?.width === "number" ? data.width : undefined);
        const height = typeof first.height === "number" ? first.height : (typeof data?.height === "number" ? data.height : undefined);

        return (
            <OverlayMedia
                overlayId={(overlay as any)?.id}
                kind={(first.kind ?? data?.kind ?? "video") as any}
                src={data?.src ?? ""}
                poster={first.poster ?? data?.poster ?? ""}
                autoplay={typeof first.autoplay === "boolean" ? first.autoplay : (typeof data?.autoplay === "boolean" ? data.autoplay : true)}
                loop={typeof first.loop === "boolean" ? first.loop : (typeof data?.loop === "boolean" ? data.loop : false)}
                muted={typeof first.muted === "boolean" ? first.muted : (typeof data?.muted === "boolean" ? data.muted : false)}
                playing={typeof first.playing === "boolean" ? first.playing : (typeof data?.playing === "boolean" ? data.playing : true)}
                title={overlay.title as any}
                description={overlay.description as any}
                variant={variant}
                aspectPreset={first.aspectPreset ?? data?.aspectPreset ?? "16:9"}
                urls={urls.length ? urls : undefined}
                segments={segments.length ? segments : undefined}
                duration={duration}
                preload={preload}
                width={width}
                height={height}
                volume={typeof first.volume === "number" ? first.volume : (typeof data?.volume === "number" ? data.volume : 1)}
                multiviewColumns={typeof data?.multiviewColumns === "number" ? data.multiviewColumns : 0}
                multiviewObjectFit={data?.multiviewObjectFit ?? "contain"}
                multiviewShowLabels={typeof data?.multiviewShowLabels === "boolean" ? data.multiviewShowLabels : false}
            />
        );
    },
    camera: renderShareOverlay,
    screen: renderShareOverlay,
    encoder: renderShareOverlay,
    pull: renderShareOverlay,
    weather: (overlay, ctx) => <WeatherOverlayRenderer overlay={overlay} ctx={ctx} />,
    card: (overlay, ctx) => {
        return <OverlayCard overlay={overlay} ctx={ctx} />;
    },
    chat: (overlay) => {
        const data = ((overlay as any)?.data ?? {}) as any;
        const channel = typeof data?.channel === 'string' ? data.channel : '';
        const maxMessages = Number.isFinite(Number(data?.maxMessages)) ? Number(data.maxMessages) : 50;
        const showBadges = typeof data?.showBadges === 'boolean' ? data.showBadges : true;
        const showColors = typeof data?.showColors === 'boolean' ? data.showColors : true;
        return (
            <OverlayChat
                channel={channel}
                maxMessages={maxMessages}
                showBadges={showBadges}
                showColors={showColors}
                title={overlay.title as any}
                description={(overlay as any)?.description}
                variant={(overlay as any)?.variant ?? 'default'}
            />
        );
    },
};

export const OVERLAY_REGISTRY = {
    models: OVERLAY_MODELS,
    renderers: overlayRenderers,
};

export const createOverlayRenderer = (ctx: OverlayRenderContext) => (overlay: CanonOverlay) => {
    const type = normalizeType((overlay as any)?.type);
    if (!type) return null;
    const render = overlayRenderers[type];
    return render ? render(overlay, ctx) : null;
};
