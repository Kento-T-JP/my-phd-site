import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function buildRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  return cutoff;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = buildRetentionCutoff(now);

  const stalePlayers = await prisma.player.findMany({
    where: {
      isDeleted: true,
      deletedAt: { lt: cutoff },
    },
    select: { id: true },
    take: 5000,
  });

  if (stalePlayers.length === 0) {
    return NextResponse.json({
      ok: true,
      deletedPlayers: 0,
      now: now.toISOString(),
      cutoff: cutoff.toISOString(),
    });
  }

  const stalePlayerIds = stalePlayers.map((player) => player.id);

  const result = await prisma.$transaction(async (tx) => {
    const [favoriteResult, rosterResult, nodeResult, playerResult] = await Promise.all([
      tx.favoritePlayer.deleteMany({ where: { playerId: { in: stalePlayerIds } } }),
      tx.rosterPlayer.deleteMany({ where: { playerId: { in: stalePlayerIds } } }),
      tx.formationNode.deleteMany({ where: { playerId: { in: stalePlayerIds } } }),
      tx.player.deleteMany({ where: { id: { in: stalePlayerIds } } }),
    ]);

    return {
      deletedPlayers: playerResult.count,
      deletedFavorites: favoriteResult.count,
      deletedRosterLinks: rosterResult.count,
      deletedFormationNodes: nodeResult.count,
    };
  });

  return NextResponse.json({
    ok: true,
    ...result,
    now: now.toISOString(),
    cutoff: cutoff.toISOString(),
  });
}
