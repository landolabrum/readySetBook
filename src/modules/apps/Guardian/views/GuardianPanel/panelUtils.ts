export const formatTime = (ts?: number) => {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "—";
  }
};

export const formatAccuracy = (val?: number) =>
  typeof val === "number" && Number.isFinite(val) ? `${Math.round(val)} m` : "—";
