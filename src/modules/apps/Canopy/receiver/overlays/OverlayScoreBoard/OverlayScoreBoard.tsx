/* =====================
   OverlayScoreBoard.tsx (UPDATED • TABLE VERSION)
   - Uses faster intro timing (≈2.6s)
   - Switches rows to <table> so columns share width (no JS)
   - Removes ID width measuring & ResizeObserver loop
   - Keeps fullscreen scale behavior and effects
   - Honors styled-jsx placement preference
   ===================== */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import styles from "./OverlayScoreBoard.scss";
import Image, { StaticImageData } from "next/image";
import environment from "~/src/core/environment";

import {
  rowKey,
  rankLabel,
  normalizeTitle,
  getText,
  stableOrder,
  computeIntroTiming, // faster timing now
  useMountReady,
  run5sIntro, // name unchanged, uses faster timing
  useFlipReorder,
  useScoreBumpEffect,
  useLeaderFlashEffect,
} from "./scoreBoardHelpers";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import UiMarkdown from "@webstack/components/UiMarkDown/controller/UiMarkDown";

type Team = {
  id?: number | string;
  vehicle_number?: string;
  name?: string;
  driver?: string;
  throttleman?: string;
  place?: number;
  score?: number;
  color?: string;
  gps?: string;
};

export type OverlayTitle =
  | string
  | { img?: string | StaticImageData; text?: string; alt?: string; width?: number; height?: number };

type Props = {
  title?: OverlayTitle;
  subTitle?: unknown;
  data: { teams: Team[] };
  fullScreen?: boolean;
  variant?: "default" | "fullscreen" | "image-left" | "image-right" | "compact" | string;
};
const DEFAULT_ROSTER_LENGTH = 20;
const DEFAULT_TITLE = "no live";

const OverlayScoreBoard: React.FC<Props> = ({ title, subTitle, data, fullScreen = false, variant = "default" }) => {
  const titleObj = useMemo(() => normalizeTitle(title, DEFAULT_TITLE), [title]);
  const titleText = titleObj.text ?? environment.merchant?.name ?? DEFAULT_TITLE;
  const subTitleText = useMemo(() => getText(subTitle), [subTitle]);

  const teams: any = data?.teams ?? [];

  // Robust check for fullscreen variant regardless of case or stray whitespace
  const isFullscreen = useMemo(() => String(variant ?? "").trim().toLowerCase() === "fullscreen", [variant]);

  /* No internal scaling — CanopyMedia scales the 1920×1080 surface already. */

  /* ----- intro (+ effects) ----- */
  // Faster total (helpers default ~2600ms). Keep max 6 rows.
  const intro = useMemo(() => computeIntroTiming(teams.length, 2600, DEFAULT_ROSTER_LENGTH), [teams.length]);
  const mounted = useMountReady();

  const headerRef = useRef<HTMLDivElement | null>(null);
  const rowNodes = useRef<Map<string, HTMLElement>>(new Map());
  const setRowNode = useCallback(
    (k: string) => (el: HTMLElement | null) => {
      if (el) rowNodes.current.set(k, el);
      else rowNodes.current.delete(k);
    },
    []
  );

  // stable, rank-ordered rows (slice to max 6)

  const prevIndex = useRef<Map<string, number>>(new Map());
  const orderedTeams = useMemo(
    () =>
      stableOrder<Team>(
        teams,
        (t) => t.place,
        prevIndex.current,
        (t, i) => rowKey(t, i)
      ).slice(0, DEFAULT_ROSTER_LENGTH),
    [teams]
  );
  // Render lock: prevent successive reorders from interrupting an in-flight animation
  const animatingRef = useRef(false);
  const queuedRef = useRef<Team[] | null>(null);
  const [renderTeams, setRenderTeams] = useState<Team[]>(orderedTeams);
  useEffect(() => {
    if (animatingRef.current) {
      queuedRef.current = orderedTeams;
    } else {
      setRenderTeams(orderedTeams);
    }
  }, [orderedTeams]);
  // One-shot intro
  const [introActive, setIntroActive] = useState(true);
  const introHasPlayedRef = useRef(false);
  const introConfigRef = useRef(intro);
  useEffect(() => {
    introConfigRef.current = intro;
  }, [intro]);
  const orderedTeamsRef = useRef(orderedTeams);
  useEffect(() => {
    orderedTeamsRef.current = orderedTeams;
  }, [orderedTeams]);

  useEffect(() => {
    if (!mounted || introHasPlayedRef.current) return;

    const prefersReduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (prefersReduce) {
      introHasPlayedRef.current = true;
      setIntroActive(false);
      return;
    }

    introHasPlayedRef.current = true;
    const config = introConfigRef.current;
    const snapshot = orderedTeamsRef.current;
    const cleanup = run5sIntro({
      headerEl: headerRef.current,
      rows: snapshot.map((t, idx) => ({
        key: rowKey(t, idx),
        el: rowNodes.current.get(rowKey(t, idx)),
        idx,
        color: t?.color,
      })),
      intro: config,
      onEnd: () => setIntroActive(false),
    });
    return cleanup;
  }, [mounted]);

  // FLIP reorder (paused during intro; resumes after)
  useFlipReorder({
    enabled: !introActive,
    rows: renderTeams.map((t, i) => ({
      key: rowKey(t, i),
      el: rowNodes.current.get(rowKey(t, i)) || null,
    })),
    prevIndexRef: prevIndex,
    onStart: () => { animatingRef.current = true; },
    onEnd: () => {
      animatingRef.current = false;
      if (queuedRef.current) {
        setRenderTeams(queuedRef.current);
        queuedRef.current = null;
      }
    },
  });

  // score bump shimmer
  useScoreBumpEffect({
    rows: renderTeams.map((t, i) => ({
      key: rowKey(t, i),
      el: rowNodes.current.get(rowKey(t, i)) || null,
      score: typeof t.score === "number" ? t.score : undefined,
      place: typeof t.place === "number" ? t.place : undefined,
    })),
  });

  // leader flash after intro
  useLeaderFlashEffect({
    enabled: !introActive,
    leaderKey: (() => {
      if (!orderedTeams.length) return undefined;
      const idx = Math.max(
        0,
        orderedTeams.findIndex((t) => t.place === 1)
      );
      const leaderIdx = idx === -1 ? 0 : idx;
      return rowKey(orderedTeams[leaderIdx]!, leaderIdx);
    })(),
    getNode: (k) => rowNodes.current.get(k) || null,
  });

  // NOTE: Removed dynamic ID width calculation & observers entirely.

  return (
    <>
      {/* Component stylesheet */}
      <style jsx>{styles}</style>
      <div className="scoreboard-wrap" data-fullscreen={fullScreen ? "true" : "false"}>
        <div
          className={`scoreboard${mounted ? " is-mounted" : ""}`}
          role="region"
          aria-label={titleText}
          data-variant={variant || "default"}
          data-intro={introActive ? "true" : "false"}
          style={undefined}
        >
          {/* Header (hidden until intro starts) */}
          <div
            className="scoreboard__header"
            role="banner"
            ref={headerRef}
            style={introActive ? { opacity: 0 } : undefined}
          >
            {titleObj.img && (
              <div className="scoreboard__brand" aria-hidden={titleObj.img ? "false" : "true"}>
                <Image
                  src={titleObj.img}
                  alt={titleObj.alt ?? ""}
                  width={titleObj.width}
                  height={titleObj.height}
                  style={{ objectFit: "contain" }}
                />
              </div>
            )}
            <div className="scoreboard__brand" aria-hidden={titleObj.img ? "false" : "true"}>
              <UiIcon icon={`${environment.merchant?.name}-logo`} />
            </div>
            <div className="scoreboard__titleWrap" aria-live="polite">
              {/* <span className="scoreboard__placeLabel" aria-hidden="true" /> */}
              <span className="scoreboard__titleText" title={titleText}>
                <UiMarkdown text=
                  {titleText}
                />              </span>
              {subTitleText && (
                <span className="scoreboard__subTitleText" title={subTitleText}>
                  <UiMarkdown text=
                    {subTitleText}
                  />
                </span>
              )}
            </div>
          </div>

          {/* Rows -> TABLE (shared column widths; no JS) */}
          <div className="scoreboard__tableWrap">
            <table className="scoreboard__table" role="table" aria-label="scoreboard">
              <colgroup>
                <col className="col-place" />
                <col className="col-name" />
                {isFullscreen && <col className="col-comp" />}
                {isFullscreen && <col className="col-comp" />}
                <col className="col-id" />
              </colgroup>
              <tbody role="rowgroup">
                {orderedTeams.map((team, idx) => {
                  const k = rowKey(team, idx);
                  const p = team.place;
                  const classes = [
                    "scoreboard__tr",
                    introActive ? "is-intro" : "",
                    p === 1 ? "is-leader" : "",
                    p === 2 ? "is-podium-2" : "",
                    p === 3 ? "is-podium-3" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  const customVars: React.CSSProperties = team?.color
                    ? ({ ["--team-color" as any]: team.color } as React.CSSProperties)
                    : {};

                  // Build up to two competitor cells for fullscreen variant; use "-" when missing
                  const comps = isFullscreen && Array.isArray((team as any)?.competitors) ? ((team as any).competitors as any[]) : [];
                  const labelFor = (i: number) => {
                    if (!isFullscreen) return undefined;
                    const c = comps[i];
                    if (!c || (!c?.name && !c?.role)) return "-";
                    const rawRole = String(c?.role ?? '').trim().toLowerCase();
                    const role = rawRole
                      ? rawRole.replace(/^./, (ch) => ch.toUpperCase())
                      : (i === 0 ? 'Driver' : i === 1 ? 'Throttleman' : 'Competitor');
                    const name = c?.name ?? '';
                    const txt =
                      <div className='scoreboard_comp' >
                        <div>
                          {`${name}`}
                        </div>
                        <small>
                          {`${role}`}
                        </small>
                      </div>;
                    return txt || "-";
                  };

                  return (
                    <tr
                      key={`${k}-${idx + 1}`}
                      data-index={idx + 1}
                      ref={setRowNode(k) as any}
                      className={classes}
                      style={introActive ? { ...customVars, opacity: 0 } : customVars}
                      role="row"
                      aria-label={`${team?.name ?? "Team"} — place ${rankLabel(p)}`}
                    >
                      <td className="scoreboard__cell scoreboard__cell--place" data-number role="cell" aria-hidden="true">
                        {p ?? "—"}
                      </td>
                      <td className="scoreboard__cell scoreboard__cell--name" role="cell" title={team?.name ?? ""}>
                        <span className="name-txt">{team?.name ?? "—"}</span>
                      </td>

                      {/* Two dedicated competitor cells (fullscreen only) */}
                      {isFullscreen && (
                        <td className="scoreboard__cell scoreboard__cell--comp" role="cell">
                          <span className="comp-txt">{labelFor(0)}</span>
                        </td>
                      )}
                      {isFullscreen && (
                        <td className="scoreboard__cell scoreboard__cell--comp" role="cell" >
                          <span className="comp-txt">{labelFor(1)}</span>
                        </td>
                      )}

                      <td
                        className="scoreboard__cell scoreboard__cell--id"
                        data-number
                        role="cell"
                        title={(String(team?.vehicle_number ?? "").trim() || "—")}
                      >
                        <span>
                          {(() => { const s = String(team?.vehicle_number ?? "").trim(); return s || "—"; })()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default OverlayScoreBoard;
