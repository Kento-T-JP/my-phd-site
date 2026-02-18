import { NextResponse } from 'next/server';
import prisma, {
  upsertTournamentRosterPlayersBySlug,
} from '@/lib/db';
import { validateJfaUrl, scrapeJfaPlayers } from '@/lib/jfa';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { resolveSessionUserId } from '@/lib/sessionUser';

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId, isAdmin } = await resolveSessionUserId(session);
  if (!isAdmin && !Number.isFinite(userId)) {
    return NextResponse.json(
      { error: 'ユーザー識別子が無効です。再ログイン後にお試しください。' },
      { status: 401 }
    );
  }
  if (!Number.isFinite(userId)) {
    return NextResponse.json(
      { error: 'Tournament owner could not be resolved.' },
      { status: 400 }
    );
  }
  const ownerId = userId as number;
  try {
    const body = await req.json();
    const url = body?.url;
    const skipExisting = Boolean(body?.skipExisting);
    if (typeof url !== 'string' || !validateJfaUrl(url)) {
      return NextResponse.json({ error: '不正なJFAメンバーURLです' }, { status: 400 });
    }
    const {
      players,
      tournamentName,
      tournamentSlug,
      rosterTitle,
      rosterDate,
    } = await scrapeJfaPlayers(url);

    const existing = await prisma.player.findMany({
      where: {
        userId: ownerId,
        name: { in: players.map((p) => p.name) },
      },
      select: { id: true, name: true, isDeleted: true },
    });
    const existingByName = new Map(existing.map((p) => [p.name, p]));

    let created = 0;
    let updated = 0;
    let restored = 0;
    let skipped = 0;
    const toCreate: typeof players = [];
    const toUpdate: { playerId: number; payload: (typeof players)[number] }[] = [];
    const processedNames = new Set<string>();
    for (const p of players) {
      const before = existingByName.get(p.name);
      processedNames.add(p.name);
      if (skipExisting && before) {
        skipped += 1;
        continue;
      }
      if (!before) {
        created += 1;
      } else if (before.isDeleted) {
        restored += 1;
      } else {
        updated += 1;
      }
      if (!before) {
        toCreate.push(p);
      } else {
        toUpdate.push({ playerId: before.id, payload: p });
      }
    }

    if (toCreate.length > 0) {
      await prisma.player.createMany({
        data: toCreate.map((p) => ({
          name: p.name,
          position: p.position,
          number: p.number,
          image: p.image,
          userId: ownerId,
          isDeleted: false,
          deletedAt: null,
        })),
      });
    }
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(({ playerId, payload }) =>
          prisma.player.update({
            where: { id: playerId },
            data: {
              name: payload.name,
              position: payload.position,
              number: payload.number,
              image: payload.image,
              isDeleted: false,
              deletedAt: null,
            },
          })
        )
      );
    }

    const processedNameList = Array.from(processedNames);
    const processedPlayers =
      processedNameList.length > 0
        ? await prisma.player.findMany({
            where: { userId: ownerId, name: { in: processedNameList } },
            select: { id: true, name: true, number: true, position: true },
          })
        : [];
    const playerByName = new Map(processedPlayers.map((p) => [p.name, p]));

    const rosterEntries: { playerId: number; number?: number; position?: string[] }[] = [];
    for (const name of processedNameList) {
      const p = playerByName.get(name);
      if (!p) continue;
      rosterEntries.push({
        playerId: p.id,
        number: p.number ?? undefined,
        position: p.position,
      });
    }

    const roster = await upsertTournamentRosterPlayersBySlug(
      tournamentSlug,
      tournamentName,
      rosterTitle,
      rosterEntries,
      ownerId,
      rosterDate,
      prisma,
    );

    const importedPlayerIds = rosterEntries.map((entry) => entry.playerId);
    await prisma.player.updateMany({
      where: { id: { in: importedPlayerIds } },
      data: { isDeleted: false, deletedAt: null },
    });

    const linked = await prisma.rosterPlayer.count({
      where: {
        rosterId: roster.id,
        playerId: { in: importedPlayerIds },
      },
    });

    return NextResponse.json({
      count: rosterEntries.length,
      requested: players.length,
      linked,
      created,
      updated,
      restored,
      skipped,
      skipExisting,
      title: roster.title,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'インポートに失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
