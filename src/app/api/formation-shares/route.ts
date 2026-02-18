import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/db";
import { authOptions } from "@/lib/authOptions";
import { FormationShareCreateSchema, FormationSharePayloadSchema } from "@/lib/schemas/formationShare";
import type { FormationSharePayload } from "@/types/formationShare";
import { getSiteUrl } from "@/lib/siteUrl";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type SessionUser = {
  user?: { id?: string; email?: string; isAdmin?: boolean; status?: string };
  loginStage?: string;
  gatePassed?: boolean;
} | null;

async function getUser() {
  const session = (await getServerSession(authOptions)) as SessionUser;
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = FormationShareCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid formationId" }, { status: 400 });
  }

  const { formationId } = parsed.data;
  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
  });
  if (!formation || formation.userId !== user.id) {
    return NextResponse.json({ error: "Formation not found" }, { status: 404 });
  }

  const positions = (formation.positions ?? {}) as {
    lineupOrder?: number[];
    benchOrder?: number[];
    playerPositions?: Record<string, { top: number; left: number }>;
    baseFormationName?: string;
  };
  const lineupOrder = Array.isArray(positions.lineupOrder) ? positions.lineupOrder : [];
  const benchOrder = Array.isArray(positions.benchOrder) ? positions.benchOrder : [];
  const playerPositions = positions.playerPositions ?? {};
  const referencedIds = new Set<number>([
    ...lineupOrder,
    ...benchOrder,
    ...Object.keys(playerPositions)
      .map((key) => Number(key))
      .filter((num) => Number.isFinite(num) && num > 0),
  ]);
  if (referencedIds.size === 0) {
    return NextResponse.json({ error: "No players in formation" }, { status: 400 });
  }

  const players = await prisma.player.findMany({
    where: {
      id: { in: Array.from(referencedIds) },
      userId: user.id,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      position: true,
      number: true,
      image: true,
      wikiUrl: true,
    },
  });
  if (players.length === 0) {
    return NextResponse.json({ error: "Players not found" }, { status: 400 });
  }

  const payload: FormationSharePayload = {
    formationName: formation.name,
    sourceFormationId: formation.id,
    baseFormationName: positions.baseFormationName,
    lineupOrder,
    benchOrder,
    playerPositions,
    players: players.map((p) => ({
      sourcePlayerId: p.id,
      name: p.name,
      position: p.position,
      number: p.number,
      image: p.image,
      wikiUrl: p.wikiUrl,
    })),
  };
  const payloadParsed = FormationSharePayloadSchema.safeParse(payload);
  if (!payloadParsed.success) {
    return NextResponse.json({ error: "Failed to create share payload" }, { status: 500 });
  }

  const token = randomBytes(20).toString("hex");
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
  await prisma.formationShare.create({
    data: {
      token,
      userId: user.id,
      formationId: formation.id,
      payload: payloadParsed.data,
      expiresAt,
    },
  });

  const configuredSite = getSiteUrl();
  const origin = configuredSite.includes("example.com")
    ? new URL(req.url).origin
    : configuredSite;
  const shareUrl = `${origin}/share/${token}`;
  return NextResponse.json({ token, shareUrl, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
