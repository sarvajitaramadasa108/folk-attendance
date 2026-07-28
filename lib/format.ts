export function normalizeMobile(value: string) {
  return value.replace(/\D/g, "").trim();
}

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatIndiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${year}-${month}-${day}`;
}

export function formatIndiaShortLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatIndiaTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function toPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

export function safeString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}
