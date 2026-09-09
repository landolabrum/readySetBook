export type RosterRow = {
  id?: string | number;
  event_id: string | number;
  team_id?: string | number | null;
  team_name: string;
  vehicle_number?: string | number | null;
  category?: string | null;
  score?: number | null;
  competitors?: Array<{ id: string; name?: string | null; position?: number | null; role?: string | null }>;
  primary_vehicle?: string | null;
};

export const coerceScore = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const sortRoster = (list: RosterRow[]) =>
  [...list].sort((a, b) => {
    const as = coerceScore(a.score ?? 0);
    const bs = coerceScore(b.score ?? 0);
    if (as !== bs) return as - bs;

    const ac = (a.category ?? "").localeCompare(b.category ?? "");
    if (ac !== 0) return ac;

    const an = Number(String(a.vehicle_number ?? "").replace(/\D+/g, "")) || 0;
    const bn = Number(String(b.vehicle_number ?? "").replace(/\D+/g, "")) || 0;
    if (an !== bn) return an - bn;

    return (a.team_name ?? "").localeCompare(b.team_name ?? "");
  });

export const reflowScores = (list: RosterRow[], teamId: string | number, desired: number) => {
  if (!list?.length) return list;

  const desiredRank = Math.max(1, Math.floor(Number(desired) || 1));
  const ordered = sortRoster(list);
  const target = ordered.find((r) => String(r.id) === String(teamId));
  if (!target) return list;

  const others = ordered.filter((r) => r !== target);
  const insertAt = Math.min(desiredRank - 1, others.length);
  const newOrder = [...others.slice(0, insertAt), target, ...others.slice(insertAt)];

  return newOrder.map((r, i) => ({ ...r, score: i + 1 }));
};

export const normalizeRosterList = (res: any): RosterRow[] => {
  if (Array.isArray(res)) return res as RosterRow[];
  if (Array.isArray(res?.data)) return res.data as RosterRow[];
  return [];
};
