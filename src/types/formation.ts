import type { PositionKey } from "@/types/player";

export interface Formation {
  name: string;
  positions: {
    [key in PositionKey]?: {
      top: number;
      left: number;
      max: number;
      allowed?: string[];
    };
  };
}

export interface FormationNode {
  id: number;
  x: number;
  y: number;
  playerId: number;
  formationId: number;
}

export interface SavedFormation extends Formation {
  id: number;
  nodes: FormationNode[];
}