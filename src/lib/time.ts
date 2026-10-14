const OFFSET_MIN = Number(process.env.ORG_UTC_OFFSET_MINUTES ?? 330); // Sri Lanka UTC+5:30

export const hhmmToMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

/** Organization-local date (YYYY-MM-DD) and minutes-since-midnight for a UTC instant */
export function toLocal(d: Date) {
  const l = new Date(d.getTime() + OFFSET_MIN * 60_000);
  return {
    date: l.toISOString().slice(0, 10),
    minutes: l.getUTCHours() * 60 + l.getUTCMinutes(),
  };
}

/** UTC instant for local midnight of YYYY-MM-DD */
export function localMidnightUtc(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - OFFSET_MIN * 60_000);
}