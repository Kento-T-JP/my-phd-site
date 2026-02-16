import { NextResponse } from 'next/server';
import prisma, {
  upsertPlayer,
  upsertTournamentRosterPlayersBySlug,
} from '@/lib/db';
import { validateJfaUrl, scrapeJfaPlayers } from '@/lib/jfa';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rawId = session.user?.id;
  const userId = rawId === undefined ? undefined : Number(rawId);
  if (!Number.isFinite(userId)) {
    return NextResponse.json(
      { error: 'ユーザー識別子が無効です。再ログイン後にお試しください。' },
      { status: 401 }
    );
  }
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
        userId: null,
        name: { in: players.map((p) => p.name) },
      },
      select: { id: true, name: true, isDeleted: true },
    });
    const existingByName = new Map(existing.map((p) => [p.name, p]));

    let created = 0;
    let updated = 0;
    let restored = 0;
    let skipped = 0;
    const rosterEntries: { playerId: number; number?: number; position?: string[] }[] = [];
    for (const p of players) {
      const before = existingByName.get(p.name);
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
      const player = await upsertPlayer({
        name: p.name,
        number: p.number,
        image: p.image,
        position: p.position,
        isDeleted: false,
        role: 'player',
      });
      rosterEntries.push({
        playerId: player.id,
        number: p.number ?? undefined,
        position: p.position,
      });
    }

    const roster = await upsertTournamentRosterPlayersBySlug(
      tournamentSlug,
      tournamentName,
      rosterTitle,
      rosterEntries,
      rosterDate,
      prisma,
      userId,
    );

    const importedPlayerIds = rosterEntries.map((entry) => entry.playerId);
    await prisma.player.updateMany({
      where: { id: { in: importedPlayerIds } },
      data: { isDeleted: false },
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
