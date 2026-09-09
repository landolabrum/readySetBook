export type KnobState = {
  angle: number;
  normalized: number;
  gain: number;
  db: number;
  percent: number;
};

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;
const DB_FLOOR = -60;

export const normalizedToDb = (n: number, floor = DB_FLOOR): number => {
  if (n <= 0) return floor;
  const db = 20 * Math.log10(n);
  return Math.max(floor, db);
};

export const dbToNormalized = (db: number, floor = DB_FLOOR): number => {
  if (db <= floor) return 0;
  return Math.pow(10, db / 20);
};

export const normalizedToAngle = (
  n: number,
  min = MIN_ANGLE,
  max = MAX_ANGLE,
): number => min + Math.max(0, Math.min(1, n)) * (max - min);

export const angleToNormalized = (
  angle: number,
  min = MIN_ANGLE,
  max = MAX_ANGLE,
): number => Math.max(0, Math.min(1, (angle - min) / (max - min)));

export const buildKnobState = (normalized: number): KnobState => {
  const n = Math.max(0, Math.min(1, normalized));
  return {
    angle: normalizedToAngle(n),
    normalized: n,
    gain: n,
    db: normalizedToDb(n),
    percent: Math.round(n * 100),
  };
};
