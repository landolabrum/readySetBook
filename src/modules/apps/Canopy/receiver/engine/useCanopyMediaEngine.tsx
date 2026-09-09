import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTeamGpsByVehicleNumber } from "../../hooks/useTeamGPS";
import { type UseCanopyMediaEngineProps, type Overlay, type Team, type PresentItem } from "./types";
import { DESIGN_H, DESIGN_W, clamp01, anchorShift, coerceTeams, normType, enabledOnlyLocal } from "./utils";
import { coerceEnabled } from "@Canopy/models/canopyOverlayTypes";
import { useDesignSurface } from "./useDesignSurface";
import { usePresenceList } from "./usePresenceList";
import { useOverlaysSource } from "./useOverlaysSource";
import { createRenderOverlay } from "./renderers";

type GpsSample = { lat: number; lon: number; timestamp: number };

const EARTH_RADIUS_MI = 3958.8;
const DEG_TO_RAD = Math.PI / 180;
const toRadians = (deg: number) => deg * DEG_TO_RAD;
const haversineMiles = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
};
const calculateSpeedMph = (prev: GpsSample | undefined, next: GpsSample): number | undefined => {
  if (!prev) return undefined;
  const deltaHours = (next.timestamp - prev.timestamp) / 3600000;
  if (!Number.isFinite(deltaHours) || deltaHours <= 0) return undefined;
  const miles = haversineMiles(prev, next);
  if (!Number.isFinite(miles) || miles < 0) return undefined;
  return miles / deltaHours;
};

/* source + normalization now lives in useOverlaysSource */

/* =========================================================================================
   Engine Hook
   ========================================================================================= */
export function useCanopyMediaEngine(props: UseCanopyMediaEngineProps) {
  const { overlays, eventId, eventMeta, source, pollMs, useSSE = true, fullScreen = true, x, y, teamsOverride, appendTeamsOverride = false, designWidth, designHeight, localPipelineStream, pipelineSessionId, pipelineHlsUrl, getStreamForSession } = props;

  const surfaceW = typeof designWidth === "number" && Number.isFinite(designWidth) ? designWidth : DESIGN_W;
  const surfaceH = typeof designHeight === "number" && Number.isFinite(designHeight) ? designHeight : DESIGN_H;

  const { enabled, groups, primaryScore, list, effectiveSource, status } = useOverlaysSource({ overlays, eventId, source, pollMs, useSSE });

  const lastNonEmptyTeamsRef = useRef<Team[]>([]);
  const liveTeams = useMemo<Team[]>(() => coerceTeams(teamsOverride), [teamsOverride]);

  // union of needed boat numbers
  const scoreboardNumbers = useMemo(() => {
    const nums = new Set<string>();

    for (const s of groups.scoreboards) {
      const teams = coerceTeams((s as any)?.data?.teams);
      for (const t of teams) {
        const id = t?.id != null ? String(t.id) : undefined;
        const veh = (t as any)?.vehicle_number ? String((t as any).vehicle_number) : undefined;
        if (id) nums.add(id);
        if (veh) nums.add(veh);
      }
    }

    if (nums.size === 0) {
      for (const t of liveTeams) {
        const id = t?.id != null ? String(t.id) : undefined;
        if (id) nums.add(id);
      }
    }

    return Array.from(nums);
  }, [groups.scoreboards, liveTeams]);

  // All team GPS numbers needed by hud/weather/map overlays.
  // Checks data.gps_source first; falls back to legacy fields for unmigrated overlays.
  const gpsSourceTeamNumbers = useMemo(() => {
    const nums = new Set<string>();
    for (const ov of enabled) {
      const type = normType(ov?.type);
      if (type !== "hud" && type !== "weather" && type !== "map") continue;
      const data = (ov as any)?.data ?? {};
      const src = data?.gps_source;
      if (src?.kind === "team") {
        const s = String(src.team_number).trim();
        if (s) nums.add(s);
      } else if (!src) {
        if (type === "map") {
          // gps_sources (new) takes priority over team_numbers (legacy)
          const srcs: any[] = Array.isArray(data?.gps_sources) ? data.gps_sources : [];
          if (srcs.length > 0) {
            for (const src of srcs) { if (src?.kind === "team" && src?.team_number) { const s = String(src.team_number).trim(); if (s) nums.add(s); } }
          } else {
            const arr = Array.isArray(data?.team_numbers) ? (data.team_numbers as any[]) : [];
            for (const n of arr) { const s = String(n).trim(); if (s) nums.add(s); }
          }
        } else {
          const tn = data?.team_number;
          const s = tn != null ? String(tn).trim() : "";
          if (s) nums.add(s);
        }
      }
    }
    return Array.from(nums);
  }, [enabled]);

  const allWantedNumbers = useMemo(() => {
    const s = new Set<string>(scoreboardNumbers);
    for (const n of gpsSourceTeamNumbers) s.add(n);
    return Array.from(s);
  }, [scoreboardNumbers, gpsSourceTeamNumbers]);

  // live GPS — only poll when at least one overlay actually needs GPS data
  const gpsEventId = allWantedNumbers.length > 0 ? eventId : undefined;
  const gps = useTeamGpsByVehicleNumber(gpsEventId, allWantedNumbers, 3000);
  const lastGpsSamplesRef = useRef<Map<string, GpsSample>>(new Map());
  const lastSpeedRef = useRef<Map<string, number>>(new Map());

  const enrichTeams = useCallback(
    (input?: Team[] | null) => {
      const baseSrc = Array.isArray(input) && input.length
        ? input
        : (liveTeams.length ? liveTeams : lastNonEmptyTeamsRef.current);

      const src = (() => {
        if (!appendTeamsOverride || !baseSrc.length || !liveTeams.length) return baseSrc;
        const key = (t: Team) => (t?.id != null ? `#${t.id}` : (t?.name ?? "").toLowerCase().trim());
        const seen = new Set(baseSrc.map(key).filter(Boolean));
        const extras = liveTeams.filter((t) => {
          const k = key(t);
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return extras.length ? [...baseSrc, ...extras] : baseSrc;
      })();

      // Merge live roster values into any pre-seeded teams so scores/places stay fresh
      const mergedSrc = (() => {
        if (!liveTeams.length || !src.length) return src;
        const byId = new Map<string, Team>();
        const byVeh = new Map<string, Team>();
        for (const t of liveTeams) {
          const id = t?.id != null ? String(t.id) : undefined;
          const veh = (t as any)?.vehicle_number ? String((t as any).vehicle_number) : undefined;
          if (id) byId.set(id, t);
          if (veh) byVeh.set(veh, t);
        }
        const matchLive = (team: Team) => {
          const id = team?.id != null ? String(team.id) : undefined;
          const veh = (team as any)?.vehicle_number ? String((team as any).vehicle_number) : undefined;
          return (id && byId.get(id)) || (veh && byVeh.get(veh)) || undefined;
        };

        return src.map((team) => {
          const live = matchLive(team);
          if (!live) return team;

          const merged: Team = { ...live, ...team };
          merged.place = live.place ?? live.score ?? merged.place;
          merged.score = live.score ?? merged.score;
          merged.vehicle_number = live.vehicle_number ?? merged.vehicle_number ?? (live.id != null ? String(live.id) : undefined);
          if ((!Array.isArray(team.competitors) || team.competitors.length === 0) && Array.isArray(live.competitors)) {
            merged.competitors = live.competitors;
          }
          if (team.color) merged.color = team.color;
          return merged;
        });
      })();

      const enriched: Team[] = mergedSrc.map((team) => {
        const id = team?.id != null ? String(team.id) : "";
        const coord = id ? gps.get(id) : undefined;
        const prev = id ? lastGpsSamplesRef.current.get(id) : undefined;
        let speedMph: number | undefined = undefined;
        if (coord) {
          const parts = String(coord).split(",").map((s) => s.trim());
          const lat = Number(parts[0]);
          const lon = Number(parts[1]);
          const deviceSpeedMps = parts[2] != null && parts[2] !== "" ? Number(parts[2]) : undefined;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            if (Number.isFinite(deviceSpeedMps as number) && (deviceSpeedMps as number) >= 0) {
              // Device-reported speed takes priority
              speedMph = Number(deviceSpeedMps) * 2.23693629;
            } else {
              const sample: GpsSample = { lat, lon, timestamp: Date.now() };
              speedMph = calculateSpeedMph(prev, sample);
              lastGpsSamplesRef.current.set(id, sample);
            }
            if (speedMph != null && Number.isFinite(speedMph)) lastSpeedRef.current.set(id, speedMph);
          }
        }
        const gpsStr = id ? gps.get(id) : undefined;
        const mphRounded = (() => {
          const v = speedMph ?? lastSpeedRef.current.get(String(team.id ?? ""));
          if (!Number.isFinite(v as number)) return undefined;
          const abs = Math.abs(v as number);
          if (abs > 0 && abs < 1) return 1;
          return Math.round(abs);
        })();
        return { ...team, gps: gpsStr, speedMph: mphRounded } as Team;
      });

      if (mergedSrc.length) lastNonEmptyTeamsRef.current = mergedSrc;
      return enriched;
    },
    [gps, liveTeams, appendTeamsOverride]
  );

  // render mapping
  const renderOverlay = useMemo(
    () => createRenderOverlay({ gps, enrichTeams, lastGpsSamplesRef, lastSpeedRef, source: source ?? effectiveSource, localPipelineStream, pipelineSessionId, pipelineHlsUrl, getStreamForSession, eventMeta: eventMeta ?? null }),
    [gps, enrichTeams, source, effectiveSource, localPipelineStream, pipelineSessionId, pipelineHlsUrl, getStreamForSession, eventMeta]
  );

  // Render only enabled overlays. Disabled overlays with preload > 0
  // are pre-mounted (hidden) so their media can buffer before going live.
  // All other disabled overlays are excluded entirely to avoid network calls.
  const renderables = useMemo(() => {
    const all = Array.isArray(list) ? [...list] : [];
    return all
      .filter((o) => {
        if (coerceEnabled(o?.enabled)) return true;
        const preload = Number((o as any)?.data?.preload);
        return Number.isFinite(preload) && preload > 0;
      })
      .sort((a, b) => Number(b?.z_index ?? 0) - Number(a?.z_index ?? 0));
  }, [list]);
  // Count only enabled overlays for the empty-state placeholder
  const renderablesCount = useMemo(() => enabledOnlyLocal(list).length, [list]);

  const present = usePresenceList(renderables);

  // container + scale for design surface
  const { containerRef, scale } = useDesignSurface(surfaceW, surfaceH);

  // compute style for item
  const getItemStyle = useCallback(
    (ov: Overlay, state: PresentItem["state"]): React.CSSProperties => {
      const leftPx = (clamp01(ov.x ?? x ?? 0) / 100) * surfaceW;
      const topPx = (clamp01(ov.y ?? y ?? 0) / 100) * surfaceH;
      // console.log({ov,state})
      const tx = anchorShift(ov.x ?? x);
      const ty = anchorShift(ov.y ?? y);
      const t = normType(ov.type);
      const variant = String(ov.variant ?? "default");
      const data = ((ov as any)?.data ?? {}) as any;

      const base: React.CSSProperties = { zIndex: Number(ov?.z_index ?? 0) };
      if (t === "ticker") {
        const widthPct = Math.max(1, clamp01(data?.width_pct ?? data?.width ?? 100));
        const heightPct = Math.max(1, clamp01(data?.height_pct ?? data?.height ?? 5));
        const widthPx = (widthPct / 100) * surfaceW;
        const heightPx = (heightPct / 100) * surfaceH;
        const yPct = Number(ov.y ?? y ?? 0);

        base.left = `${leftPx}px`;
        base.top = `${Math.min(topPx, surfaceH)}px`;
        base.width = `${widthPx}px`;
        base.height = `${heightPx}px`;

        const translateY = yPct >= 95 ? -100 : ty;
        const translateX = tx || 0;
        base.transform = translateX || translateY ? `translate(${translateX}%, ${translateY}%)` : undefined;
      } else if (t === "scoreboard" && variant === "fullscreen") {
        base.left = 0;
        base.top = 0;
        base.width = `${surfaceW}px`;
        base.height = `${surfaceH}px`;
        base.transform = undefined;
      } else if (t === "media" && variant === "fullscreen") {
        base.left = 0;
        base.top = 0;
        // base.width = `${surfaceW}px`;
        // base.height = `${surfaceH}px`;
        base.transform = undefined;
      } else {
        base.left = `${leftPx}px`;
        base.top = `${topPx}px`;
        // Default anchor behavior
        let transform = tx || ty ? `translate(${tx}%, ${ty}%)` : undefined;

        // Heuristic: keep compact overlays like lapcounter on-screen when near edges.
        if (t === "lapcounter") {
          const xp = clamp01(ov.x ?? x ?? 0);
          const yp = clamp01(ov.y ?? y ?? 0);
          const shifts: string[] = [];
          if (xp >= 90) shifts.push("-100%", ty ? `${ty}%` : "0");
          else if (tx || ty) shifts.push(`${tx || 0}%`, `${ty || 0}%`);
          if (shifts.length) transform = `translate(${shifts[0]}, ${shifts[1] ?? "0"})`;
        }
        base.transform = transform;
      }

      // Dynamic percentage-based dimensions for all non-fullscreen overlays.
      // Convert percentage (0–100) → design-surface pixels.
      // Media/share-family overlays that haven't been resized yet get a sensible default
      // (~33% width, with 16:9 aspect ratio derived height).
      if (variant !== "fullscreen") {
        const ovW = (ov as any)?.width;
        const ovH = (ov as any)?.height;

        const isShareFamily = t === "camera" || t === "screen" || t === "encoder" || t === "pull";
        const isMedia = t === "media" || isShareFamily;
        const hasOvDims = typeof ovW === 'number' && ovW > 0 && typeof ovH === 'number' && ovH > 0;
        const needsMediaDefault = isMedia && !hasOvDims;
        // Weather/map overlays without explicit dimensions get a sensible default
        // to prevent unconstrained expansion (min-width: max-content blowout).
        const needsInfoDefault = (t === "weather" || t === "map") && !hasOvDims;
        const needsChatDefault = t === "chat" && !hasOvDims;

        let effectiveW: number;
        let effectiveH: number;

        if (hasOvDims) {
          // User-set percentage dimensions (from resize or manual entry) always win
          effectiveW = ovW;
          effectiveH = ovH;
        } else if (needsMediaDefault) {
          // Fallback: use segment pixel dimensions if available, else 33.33% default
          let dataPixelW = 0;
          let dataPixelH = 0;
          const segs = data?.segments;
          const firstSeg = Array.isArray(segs) && segs.length ? segs[0] : null;
          const pw = Number(firstSeg?.width ?? data?.width);
          const ph = Number(firstSeg?.height ?? data?.height);
          if (Number.isFinite(pw) && pw > 0) dataPixelW = pw;
          if (Number.isFinite(ph) && ph > 0) dataPixelH = ph;

          if (dataPixelW > 0 || dataPixelH > 0) {
            effectiveW = dataPixelW > 0 ? (dataPixelW / surfaceW) * 100 : 0;
            effectiveH = dataPixelH > 0 ? (dataPixelH / surfaceH) * 100 : 0;
          } else {
            effectiveW = 33.33;
            effectiveH = 33.33 * (surfaceW / surfaceH) * (9 / 16);
          }
        } else if (needsInfoDefault) {
          effectiveW = 25;
          effectiveH = 55;
        } else if (needsChatDefault) {
          effectiveW = 22;
          effectiveH = 60;
        } else {
          effectiveW = typeof ovW === 'number' && ovW > 0 ? ovW : 0;
          effectiveH = typeof ovH === 'number' && ovH > 0 ? ovH : 0;
        }

        // W/H are always % of the design surface (px units were removed).
        if (effectiveW > 0) {
          base.width = `${(effectiveW / 100) * surfaceW}px`;
        }
        if (effectiveH > 0) {
          base.height = `${(effectiveH / 100) * surfaceH}px`;
        }
      }

      // Hide preloaded-but-disabled overlays so their media can buffer
      // without being visible; fully disabled overlays are excluded upstream.
      if (!coerceEnabled((ov as any)?.enabled)) {
        base.opacity = 0;
        base.pointerEvents = 'none';
        base.overflow = 'hidden';
        base.width = '1px';
        base.height = '1px';
      }

      // Global fade behavior for all overlays
      if (state === "enter") base.opacity = 0;
      else if (state === "exit") base.opacity = 0;
      else if ((ov as any)?.opacity != null) {
        const o = Number((ov as any).opacity);
        if (Number.isFinite(o)) base.opacity = o;
      }

      // Crop: clip-path inset from each edge [top, bottom, left, right]
      const crop = (ov as any)?.crop;
      if (Array.isArray(crop) && crop.length >= 4 && crop.some((v: any) => typeof v === 'number' && v > 0)) {
        const [t, b, l, r] = crop.map((v: any) => (typeof v === 'number' && v > 0 ? v : 0));
        (base as any).clipPath = `inset(${t}% ${r}% ${b}% ${l}%)`;
      }

      return base;
    },
    [x, y, designWidth, designHeight]
  );

  return {
    containerRef,
    scale,
    present,
    renderOverlay,
    getItemStyle,
    DESIGN_W: surfaceW,
    DESIGN_H: surfaceH,
    renderablesCount,
    debugInfo: {
      source: effectiveSource,
      status,
      listCount: Array.isArray(list) ? list.length : 0,
      enabledCount: enabled.length,
      groups: {
        scoreboards: groups.scoreboards.length,
        ticker: groups.ticker.length,
        maps: groups.maps.length,
        other: groups.other.length,
      },
    },
    status,
  } as const;
}

export type UseCanopyMediaEngineReturn = ReturnType<typeof useCanopyMediaEngine>;
