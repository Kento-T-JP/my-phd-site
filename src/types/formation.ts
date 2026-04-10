import type { PositionKey } from "@/types/player";
import { z } from "zod";

export const FormationNodeSchema = z.object({
  x: z.number(),
  y: z.number(),
  playerId: z.number().int(),
});

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

export type FormationNode = z.infer<typeof FormationNodeSchema> & {
  id: number;
  formationId: number;
};

export interface SavedFormation {
  id: number;
  name: string;
  positions: {
    lineupOrder: number[];
    benchOrder: number[];
    benchSize?: number;
    offBenchSize?: number;
    playerPositions: Record<number, { top: number; left: number }>;
    baseFormationName?: string;
  };
  nodes: FormationNode[];
  userId?: number;
  owner?: {
    id: number;
    name: string | null;
    email: string;
  };
  collaborators?: Array<{
    id: number;
    name: string | null;
    email: string;
  }>;
  activeEditors?: Array<{
    id: number;
    name: string | null;
    email: string;
    lastSeenAt: string | Date;
  }>;
  accessRole?: "owner" | "collaborator";
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
