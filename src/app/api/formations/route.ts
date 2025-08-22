import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { z } from "zod";
import { FormationNodeSchema } from "@/types/formation";
import type { FormationNode } from "@/types/formation";

const PlayerPosSchema = z.object({ top: z.number(), left: z.number() });

const PositionsSchema = z.object({
  lineupOrder: z.array(z.number()).optional(),
  benchOrder: z.array(z.number()).optional(),
  playerPositions: z.record(z.string(), PlayerPosSchema).optional(),
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

async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await prisma.formation.findMany({
    where: { userId: user.id },
    orderBy: { id: "asc" },
    include: { nodes: true },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = FormationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const { name, positions, nodes } = parsed.data;
  const saved = await prisma.formation.create({
    data: {
      name: name || "Untitled",
      positions,
      userId: user.id,
      nodes: nodes
        ? {
            create: nodes.map((n: FormationNode) => ({
              x: n.x,
              y: n.y,
              playerId: n.playerId,
            })),
          }
        : undefined,
    },
    include: { nodes: true },
  });
  return NextResponse.json(saved, { status: 201 });
}

