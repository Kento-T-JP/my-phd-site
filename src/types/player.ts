export type PositionKey =
  | 'GK' | 'LB' | 'CB' | 'RB'
  | 'CM' | 'LM' | 'RM'
  | 'LW' | 'ST' | 'RW'
  | (string & {}); // 自由入力も許可

export interface Player {
  id: number;
  name: string;
  position: string[]; // 複数ポジション対応
  number?: number;
  image?: string;
  rosterPlayers?: RosterPlayer[];
}

export interface Tournament {
  id: number;
  name: string;
  rosters?: Roster[];
}

export interface Roster {
  id: number;
  date: Date;
  tournamentId: number;
  tournament?: Tournament;
  players?: RosterPlayer[];
}

export interface RosterPlayer {
  rosterId: number;
  playerId: number;
}