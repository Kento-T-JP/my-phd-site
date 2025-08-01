export interface RosterForDisplay {
  id: number;
  date: string;
  tournamentId: number;
  tournament: { name: string };
}

/**
 * Format a roster title for dropdowns. If the tournament only has one roster in
 * the provided list, the date portion is omitted.
 */
export function rosterDisplayTitle(
  r: RosterForDisplay,
  list?: RosterForDisplay[]
): string {
  const count = list?.filter((ro) => ro.tournamentId === r.tournamentId).length;
  if (count === 1) return r.tournament.name;
  return `${r.tournament.name} - ${r.date.slice(0, 10).replace(/-/g, '/')}`;
}
