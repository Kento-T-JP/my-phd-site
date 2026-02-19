import { z } from "zod";

const SharePlayerSchema = z.object({
  sourcePlayerId: z.number().int().positive(),
  name: z.string().min(1),
  position: z.array(z.string().min(1)).min(1),
  number: z.number().int().nullable().optional(),
  image: z.string().nullable().optional(),
  wikiUrl: z.string().nullable().optional(),
  affiliations: z
    .array(
      z.object({
        tournamentName: z.string().min(1),
        rosterTitle: z.string().min(1),
        rosterDate: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export const FormationSharePayloadSchema = z.object({
  formationName: z.string().min(1),
  sourceFormationId: z.number().int().positive(),
  baseFormationName: z.string().optional(),
  lineupOrder: z.array(z.number().int().positive()),
  benchOrder: z.array(z.number().int().positive()),
  benchSize: z.number().int().min(0).max(15).optional(),
  offBenchSize: z.number().int().min(0).max(999).optional(),
  playerPositions: z.record(
    z.string(),
    z.object({
      top: z.number(),
      left: z.number(),
    })
  ),
  players: z.array(SharePlayerSchema),
});

export const FormationShareCreateSchema = z.object({
  formationId: z.number().int().positive(),
});
