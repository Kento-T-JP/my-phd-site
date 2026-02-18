export function parseDateFromParts(
  year: string | number,
  month: string | number,
  day: string | number,
): Date | undefined {
  const y = typeof year === 'number' ? year : Number(year);
  const m = typeof month === 'number' ? month : Number(month);
  const d = typeof day === 'number' ? day : Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return undefined;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return undefined;
  }
  return date;
}

export function formatDateUtc(date: Date, separator: '/' | '-' = '/'): string {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return [yyyy, mm, dd].join(separator);
}
