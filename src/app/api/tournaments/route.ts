import { NextResponse } from 'next/server';
import prisma, { getTournaments, upsertTournament } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { resolveSessionUserId } from '@/lib/sessionUser';
import { cacheTag } from '@/lib/cacheTags';
import { revalidateTagSafe, runWithCache } from '@/lib/cacheRuntime';

function normalizeTournamentName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const { userId } = await resolveSessionUserId(session);
  if (!Number.isFinite(userId)) {
    return NextResponse.json([]);
  }
  const ownerId = userId as number;
  const list = await runWithCache(
    async () => getTournaments(ownerId),
    ['api-tournaments', String(ownerId)],
    {
      revalidate: 60,
      tags: [cacheTag.tournaments(ownerId), cacheTag.tournamentsNames(ownerId)],
    },
  );
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;
    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }
    const normalizedName = normalizeTournamentName(name);
    if (!normalizedName) {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
    }

    const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
    if (!session?.user?.email) {
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
    const tournaments = await getTournaments(ownerId);
    const duplicate = tournaments.some(
      (t) => normalizeTournamentName(t.name).toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { error: '同じ名前のトーナメントは作成できません。' },
        { status: 409 }
      );
    }

    const tournament = await upsertTournament(normalizedName, ownerId);
    revalidateTagSafe(cacheTag.tournaments(ownerId));
    revalidateTagSafe(cacheTag.tournamentsNames(ownerId));
    revalidateTagSafe(cacheTag.rosters(ownerId));
    revalidateTagSafe(cacheTag.rostersTitles(ownerId));
    return NextResponse.json(tournament);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upsert tournament';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = (await getServerSession(authOptions)) as {
    user?: { id?: string; email?: string; isAdmin?: boolean; status?: string };
    loginStage?: string;
    gatePassed?: boolean;
  } | null;
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, isAdmin } = await resolveSessionUserId(session);
  if (!isAdmin && !Number.isFinite(userId)) {
    return NextResponse.json(
      { error: 'ユーザー識別子が無効です。再ログイン後にお試しください。' },
      { status: 401 },
    );
  }
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Tournament owner could not be resolved.' }, { status: 400 });
  }
  const ownerId = userId as number;

  try {
    const body = await req.json();
    const tournamentId = Number(body?.tournamentId);
    if (!Number.isFinite(tournamentId)) {
      return NextResponse.json({ error: 'Invalid tournamentId' }, { status: 400 });
    }

    const targetTournament = await prisma.tournament.findFirst({
      where: { id: tournamentId, userId: ownerId },
      select: { id: true },
    });
    if (!targetTournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const rosterIds = (
      await prisma.roster.findMany({
        where: { tournamentId: targetTournament.id, userId: ownerId },
        select: { id: true },
      })
    ).map((r) => r.id);

    await prisma.$transaction(async (tx) => {
      if (rosterIds.length > 0) {
        await tx.rosterPlayer.deleteMany({ where: { rosterId: { in: rosterIds } } });
        await tx.roster.deleteMany({ where: { id: { in: rosterIds } } });
      }
      await tx.tournament.delete({ where: { id: targetTournament.id } });
    });

    revalidateTagSafe(cacheTag.rosters(ownerId));
    revalidateTagSafe(cacheTag.rostersTitles(ownerId));
    revalidateTagSafe(cacheTag.tournaments(ownerId));
    revalidateTagSafe(cacheTag.tournamentsNames(ownerId));

    return NextResponse.json({ ok: true, tournamentId: targetTournament.id, deletedRosterCount: rosterIds.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete tournament';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
