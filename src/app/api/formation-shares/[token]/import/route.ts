import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma, { addRosterPlayers, upsertRoster, upsertTournament } from "@/lib/db";
import { authOptions } from "@/lib/authOptions";
import { FormationSharePayloadSchema } from "@/lib/schemas/formationShare";
import { unwrapParams } from "@/lib/unwrap";

type SessionUser = {
  user?: { id?: string; email?: string; isAdmin?: boolean; status?: string };
  loginStage?: string;
  gatePassed?: boolean;
} | null;

function normalizeName(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
}

function normalizeLabel(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

async function getUser() {
  const session = (await getServerSession(authOptions)) as SessionUser;
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

async function buildImportedName(userId: number, baseName: string) {
  const trimmed = baseName.trim() || "Shared Formation";
  const current = await prisma.formation.findFirst({
    where: { userId, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (!current) return trimmed;
  const suffix = " (imported)";
  const fallback = `${trimmed}${suffix}`;
  const fallbackCurrent = await prisma.formation.findFirst({
    where: { userId, name: { equals: fallback, mode: "insensitive" } },
    select: { id: true },
  });
  if (!fallbackCurrent) return fallback;
  for (let i = 2; i <= 100; i += 1) {
    const candidate = `${trimmed}${suffix} ${i}`;
    const dup = await prisma.formation.findFirst({
      where: { userId, name: { equals: candidate, mode: "insensitive" } },
      select: { id: true },
    });
    if (!dup) return candidate;
  }
  return `${trimmed}${suffix} ${Date.now()}`;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await unwrapParams(params);
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const share = await prisma.formationShare.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      payload: true,
    },
  });
  if (!share) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  if (share.expiresAt < new Date()) {
    return NextResponse.json({ error: "Share expired" }, { status: 410 });
  }

  const payloadParsed = FormationSharePayloadSchema.safeParse(share.payload);
  if (!payloadParsed.success) {
    return NextResponse.json({ error: "Invalid share payload" }, { status: 500 });
  }
  const payload = payloadParsed.data;
  const sourcePlayerIds = payload.players.map((p) => p.sourcePlayerId);
  const uniqueSourcePlayerIds = Array.from(new Set(sourcePlayerIds));

  const importedName = await buildImportedName(user.id, payload.formationName);
  const formation = await prisma.$transaction(async (tx) => {
    const existingPlayers = await tx.player.findMany({
      where: {
        userId: user.id,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
      },
    });
    const byNormalizedName = new Map<string, number>();
    existingPlayers.forEach((player) => {
      byNormalizedName.set(normalizeName(player.name), player.id);
    });

    const sourceToTargetId = new Map<number, number>();
    for (const sourceId of uniqueSourcePlayerIds) {
      const snapshot = payload.players.find((p) => p.sourcePlayerId === sourceId);
      if (!snapshot) continue;
      const normalized = normalizeName(snapshot.name);
      const existingId = byNormalizedName.get(normalized);
      if (existingId) {
        sourceToTargetId.set(sourceId, existingId);
        continue;
      }
      const resolved = await tx.player.upsert({
        where: {
          userId_name: {
            userId: user.id,
            name: snapshot.name.trim(),
          },
        },
        update: {
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          userId: user.id,
          name: snapshot.name.trim(),
          position: snapshot.position,
          number: snapshot.number ?? null,
          image: snapshot.image ?? null,
          wikiUrl: snapshot.wikiUrl ?? null,
          isDeleted: false,
          deletedAt: null,
        },
        select: { id: true, name: true },
      });
      sourceToTargetId.set(sourceId, resolved.id);
      byNormalizedName.set(normalized, resolved.id);
    }

    const rosterKeyToId = new Map<string, number>();
    const rosterIdToPlayers = new Map<
      number,
      Map<number, { playerId: number; number?: number; position?: string[] }>
    >();
    for (const snapshot of payload.players) {
      const targetPlayerId = sourceToTargetId.get(snapshot.sourcePlayerId);
      if (!targetPlayerId) continue;
      for (const affiliation of snapshot.affiliations ?? []) {
        const tournamentName = normalizeLabel(affiliation.tournamentName);
        const rosterTitle = normalizeLabel(affiliation.rosterTitle);
        if (!tournamentName || !rosterTitle) continue;
        const key = `${normalizeName(tournamentName)}::${normalizeName(rosterTitle)}`;
        let rosterId = rosterKeyToId.get(key);
        if (!rosterId) {
          const tournament = await upsertTournament(tournamentName, user.id, tx);
          const rosterDate =
            affiliation.rosterDate && !Number.isNaN(Date.parse(affiliation.rosterDate))
              ? new Date(affiliation.rosterDate)
              : undefined;
          const roster = await upsertRoster(
            tournament.id,
            rosterTitle,
            user.id,
            tx,
            rosterDate,
          );
          rosterId = roster.id;
          rosterKeyToId.set(key, roster.id);
        }
        if (!rosterIdToPlayers.has(rosterId)) {
          rosterIdToPlayers.set(rosterId, new Map());
        }
        const perRosterPlayers = rosterIdToPlayers.get(rosterId);
        if (!perRosterPlayers) continue;
        if (!perRosterPlayers.has(targetPlayerId)) {
          perRosterPlayers.set(targetPlayerId, {
            playerId: targetPlayerId,
            number: snapshot.number ?? undefined,
            position: snapshot.position,
          });
        }
      }
    }

    for (const [rosterId, playersMap] of rosterIdToPlayers.entries()) {
      await addRosterPlayers(
        rosterId,
        Array.from(playersMap.values()),
        tx,
      );
    }

    const lineupOrder = payload.lineupOrder
      .map((id) => sourceToTargetId.get(id))
      .filter((id): id is number => typeof id === "number");
    const benchOrder = payload.benchOrder
      .map((id) => sourceToTargetId.get(id))
      .filter((id): id is number => typeof id === "number");
    const benchSize =
      typeof payload.benchSize === "number" && Number.isFinite(payload.benchSize)
        ? Math.max(0, Math.min(15, Math.trunc(payload.benchSize)))
        : 12;
    const playerPositions: Record<number, { top: number; left: number }> = {};
    Object.entries(payload.playerPositions).forEach(([sourceId, pos]) => {
      const targetId = sourceToTargetId.get(Number(sourceId));
      if (targetId) {
        playerPositions[targetId] = { top: pos.top, left: pos.left };
      }
    });

    return tx.formation.create({
      data: {
        userId: user.id,
        name: importedName,
        positions: {
          lineupOrder,
          benchOrder,
          benchSize,
          playerPositions,
          baseFormationName: payload.baseFormationName,
        },
      },
      include: { nodes: { orderBy: { id: "asc" } } },
    });
  });

  const ip = _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const userAgent = _req.headers.get("user-agent") || undefined;
  await prisma.visit
    .create({
      data: {
        path: `/event/formation_share_imported?token=${token}`,
        ip,
        userAgent,
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, formation }, { status: 201 });
}
