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
  tournament?: string;
}