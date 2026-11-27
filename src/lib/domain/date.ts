const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatIsoDate(isoDate: string): string {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) {
    throw new RangeError(`Fecha con formato no válido: ${isoDate}`);
  }
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
