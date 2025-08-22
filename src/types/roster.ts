export interface RosterSummary {
  id: number;
  date: string;
  endDate?: string | null;
  title?: string;
  tournamentId: number;
  tournament: { name: string };
}

export interface RosterInfo {
  id: number;
  tournament?: { name: string } | null;
}
