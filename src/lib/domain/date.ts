const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatIsoDate(isoDate: string): string {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) {
    throw new RangeError(`Fecha con formato no válido: ${isoDate}`);
  }
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export const BUSINESS_TIME_ZONE = "Europe/Madrid";

export function isoDateInTimeZone(instant: Date, timeZone: string): string {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("isoDateInTimeZone: instante no válido.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const part = (type: "year" | "month" | "day") =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}
