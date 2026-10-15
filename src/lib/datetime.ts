export const TZ = "Asia/Colombo";
const OFFSET = "+05:30";

export const toIso = (date: string, time: string) => `${date}T${time}:00${OFFSET}`;

export const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, dateStyle: "medium" }).format(new Date(iso));

export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso)
  );

export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;

export const fmtRange = (s: string, e: string) => `${fmtDate(s)} · ${fmtTime(s)} – ${fmtTime(e)}`;