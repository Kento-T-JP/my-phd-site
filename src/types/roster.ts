export interface RosterSummary {
  id: number;
  date: string;
  endDate?: string | null;
  title?: string;
  tournamentId: number;
  tournament: { name: string };
}
