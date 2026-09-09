import useWindow from "@webstack/hooks/window/useWindow";

type BreakPointEntry = {
  id: string;
  breakpoint: number;
  value?: number;
};

function findBreakPoint(target: number, data: BreakPointEntry[]): number | undefined {
  const filtered = data.filter((e) => e.value !== undefined);
  if (!filtered.length) return undefined;
  return filtered.reduce((prev, curr) =>
    Math.abs(curr.breakpoint - target) < Math.abs(prev.breakpoint - target) ? curr : prev
  ).value;
}

export type BreakPoints = {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  xxl?: number;
};

export default function useBreakPoints({ xs, sm, md, lg, xl, xxl }: BreakPoints): number | undefined {
  const { width } = useWindow();
  return findBreakPoint(width, [
    { id: "xs", breakpoint: 600, value: xs },
    { id: "sm", breakpoint: 900, value: sm },
    { id: "md", breakpoint: 1080, value: md },
    { id: "lg", breakpoint: 1260, value: lg },
    { id: "xl", breakpoint: 1400, value: xl },
    { id: "xxl", breakpoint: 1400, value: xxl },
  ]);
}
