export const formatTime = (value?: number) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(value);
  } catch {
    return new Date(value).toLocaleTimeString();
  }
};
