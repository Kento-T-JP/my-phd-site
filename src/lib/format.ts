export interface RosterForDisplay {
  id: number;
  date: string | Date;
  endDate?: string | Date | null;
  tournamentId: number;
  title?: string;
  tournament?: { name: string };
}

const formatDatePart = (value: string | Date): string => {
  const raw = typeof value === "string" ? value : value.toISOString();
  return raw.slice(0, 10).replace(/-/g, "/");
};

/**
 * Format a roster title for dropdowns. If the tournament only has one roster in
 * the provided list, the date portion is omitted.
 */
export function rosterDisplayTitle(r: RosterForDisplay): string {
  if (r.title) {
    return r.title;
  }
  const start = formatDatePart(r.date);
  const end = r.endDate ? `-${formatDatePart(r.endDate)}` : "";
  const tournamentName = r.tournament?.name ?? "Roster";
  return `${tournamentName} - ${start}${end}`;
}
