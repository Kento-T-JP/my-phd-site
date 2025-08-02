export interface RosterForDisplay {
  id: number;
  date: string;
  endDate?: string | null;
  tournamentId: number;
  title?: string;
  tournament: { name: string };
}

/**
 * Format a roster title for dropdowns. If the tournament only has one roster in
 * the provided list, the date portion is omitted.
 */
export function rosterDisplayTitle(r: RosterForDisplay): string {
  if (r.title) {
    return r.title;
  }
  const start = r.date.slice(0, 10).replace(/-/g, '/');
  const end = r.endDate ? `-${r.endDate.slice(0, 10).replace(/-/g, '/')}` : '';
  return `${r.tournament.name} - ${start}${end}`;
}
