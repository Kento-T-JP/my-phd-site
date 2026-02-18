export interface SharedPlayerSnapshot {
  sourcePlayerId: number;
  name: string;
  position: string[];
  number?: number | null;
  image?: string | null;
  wikiUrl?: string | null;
}

export interface FormationSharePayload {
  formationName: string;
  sourceFormationId: number;
  baseFormationName?: string;
  lineupOrder: number[];
  benchOrder: number[];
  playerPositions: Record<string, { top: number; left: number }>;
  players: SharedPlayerSnapshot[];
}
