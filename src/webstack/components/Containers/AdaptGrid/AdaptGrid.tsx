import React, { useEffect, useRef } from "react";
import styles from "./AdaptGrid.scss";
import useBreakPoints from "@webstack/hooks/window/useBreakPoints";

export interface iAdaptGrid {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  xxl?: number;
  gap?: number;
  gapX?: number;
  gapY?: number;
  margin?: string;
  padding?: string;
  children?: any;
  variant?: string;
  scroll?: string;
  responsive?: boolean;
  reverse?: boolean;
  focus?: any;
  align?: "center";
  backgroundColor?: string;
}

export default function AdaptGrid({
  focus,
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
  children,
  variant,
  gap,
  gapX,
  gapY,
  margin,
  padding,
  responsive: dynamic,
  scroll,
  reverse,
  align,
  backgroundColor,
}: iAdaptGrid) {
  const columns = useBreakPoints({ xs, sm, md, lg, xl, xxl });
  const ref = useRef<any>(null);

  useEffect(() => {
    const gridElement = ref.current;
    if (!gridElement) return;

    const style = {
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gridColumnGap: `${gapX ? gapX : gap}px`,
      gridRowGap: `${gapY ? gapY : gap}px`,
      paddingTop: `${gap ? gap / 2 : 0}px`,
      paddingBottom: `${gap ? gap / 2 : 0}px`,
      margin: `${margin ? margin : "0px"}`,
      padding: `${padding ? padding : "0px"}`,
      direction: `${reverse ? "rtl" : "ltr"}`,
    };

    Object.assign(gridElement.style, style);
  }, [columns, gap, gapX, gapY, margin, padding, ref, focus, reverse, backgroundColor]);

  const flatChildren = variant ? React.Children.toArray(children).flat() : children;
  const childrenLength = flatChildren?.length;

  return (
    <>
      <style jsx>{styles}</style>
      <div
        ref={ref}
        className={`adaptgrid ${align ? ` ${align}` : ""}${scroll ? ` ${scroll}` : ""}`}
      >
        {!variant && children && children}
        {variant &&
          childrenLength &&
          flatChildren.map((child: any, key: number) => (
            <div
              key={key}
              style={backgroundColor ? { backgroundColor: backgroundColor } : {}}
              className={`adaptgrid__grid-item${variant ? ` adaptgrid_${variant}` : ""}`}
            >
              {child}
            </div>
          ))}
        {!children && !childrenLength && (
          <div
            style={backgroundColor ? { backgroundColor: backgroundColor } : {}}
            className={`adaptgrid__grid-item${variant ? ` adaptgrid_${variant}` : ""}`}
          >
            {children}
          </div>
        )}
      </div>
    </>
  );
}
