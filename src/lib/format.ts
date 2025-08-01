export function rosterDisplayTitle(r: { date: string; tournament: { name: string } }): string {
  return `${r.tournament.name} - ${r.date.slice(0, 10).replace(/-/g, '/')}`;
}
