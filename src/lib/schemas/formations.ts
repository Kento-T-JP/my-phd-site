import { z } from "zod";
import { FormationNodeSchema } from "@/types/formation";

const PlayerPosSchema = z.object({ top: z.number(), left: z.number() });

const PositionsSchema = z.object({
  lineupOrder: z.array(z.number()).optional(),
  benchOrder: z.array(z.number()).optional(),
  benchSize: z.number().int().min(0).max(15).optional(),
  playerPositions: z.record(z.string(), PlayerPosSchema).optional(),
  baseFormationName: z.string().optional(),
});

export const FormationCreateSchema = z.object({
  name: z.string().optional(),
  positions: PositionsSchema,
  nodes: z.array(FormationNodeSchema).optional(),
});

export const FormationUpdateSchema = z.object({
  name: z.string().optional(),
  positions: PositionsSchema.optional(),
  nodes: z.array(FormationNodeSchema).optional(),
});
