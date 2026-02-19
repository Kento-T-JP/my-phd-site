export interface SharedRosterAffiliation {
  tournamentName: string;
  rosterTitle: string;
  rosterDate?: string | null;
}

export interface SharedPlayerSnapshot {
  sourcePlayerId: number;
  name: string;
  position: string[];
  number?: number | null;
  image?: string | null;
  wikiUrl?: string | null;
  affiliations?: SharedRosterAffiliation[];
}

export interface FormationSharePayload {
  formationName: string;
  sourceFormationId: number;
  baseFormationName?: string;
  lineupOrder: number[];
  benchOrder: number[];
  benchSize?: number;
  offBenchSize?: number;
  playerPositions: Record<string, { top: number; left: number }>;
  players: SharedPlayerSnapshot[];
}
