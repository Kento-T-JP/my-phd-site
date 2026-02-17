import { NextResponse } from 'next/server';
import prisma, { getRosters, ensureTournamentRoster } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { resolveSessionUserId } from '@/lib/sessionUser';
import { cacheTag } from '@/lib/cacheTags';
import { revalidateTagSafe, runWithCache } from '@/lib/cacheRuntime';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug') || undefined;
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  const { userId } = await resolveSessionUserId(session);
  if (!Number.isFinite(userId)) {
    return NextResponse.json([]);
  }
  const ownerId = userId as number;
  const rosters = await runWithCache(
    async () => getRosters(slug, ownerId),
    ['api-rosters', String(ownerId), slug ?? 'all'],
    {
      revalidate: 60,
      tags: [cacheTag.rosters(ownerId), cacheTag.rostersTitles(ownerId)],
    },
  );
  return NextResponse.json(rosters);
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId, isAdmin } = await resolveSessionUserId(session);
  if (!isAdmin && !Number.isFinite(userId)) {
    return NextResponse.json(
      { error: 'ユーザー識別子が無効です。再ログイン後にお試しください。' },
      { status: 401 }
    );
  }
  const ownerId = Number.isFinite(userId) ? (userId as number) : undefined;
  try {
    const { tournament } = await req.json();
    if (!tournament || typeof tournament !== 'string') {
      return NextResponse.json({ error: 'Invalid tournament' }, { status: 400 });
    }
    if (!ownerId) {
      return NextResponse.json(
        { error: 'Tournament owner could not be resolved.' },
        { status: 400 },
      );
    }
    const roster = await ensureTournamentRoster(
      tournament,
      ownerId,
      prisma,
    );
    const full = await prisma.roster.findUnique({
      where: { id: roster.id },
      include: { tournament: true },
    });
    revalidateTagSafe(cacheTag.rosters(ownerId));
    revalidateTagSafe(cacheTag.rostersTitles(ownerId));
    revalidateTagSafe(cacheTag.tournaments(ownerId));
    revalidateTagSafe(cacheTag.tournamentsNames(ownerId));
    return NextResponse.json(full ?? roster, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create roster';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string; isAdmin?: boolean; status?: string }; loginStage?: string; gatePassed?: boolean } | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isAdmin = Boolean(session.user.isAdmin);
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'ロスター削除は管理者画面から実行してください。' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const tournament = typeof body?.tournament === 'string' ? body.tournament.trim() : '';
    if (!title || !tournament) {
      return NextResponse.json(
        { error: 'Tournament and roster title are required' },
        { status: 400 }
      );
    }

    const roster = await prisma.roster.findFirst({
      where: {
        title: {
          equals: title,
          mode: 'insensitive',
        },
        tournament: {
          name: {
            equals: tournament,
            mode: 'insensitive',
          },
        },
      },
      include: {
        tournament: { select: { name: true } },
      },
    });

    if (!roster) {
      return NextResponse.json({ error: 'Roster not found' }, { status: 404 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.rosterPlayer.deleteMany({
        where: { rosterId: roster.id },
      });
      await tx.roster.delete({
        where: { id: roster.id },
      });
    });
    revalidateTagSafe(cacheTag.rosters(roster.userId));
    revalidateTagSafe(cacheTag.rostersTitles(roster.userId));
    revalidateTagSafe(cacheTag.tournaments(roster.userId));
    revalidateTagSafe(cacheTag.tournamentsNames(roster.userId));

    return NextResponse.json({
      ok: true,
      title: roster.title,
      tournament: roster.tournament.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete roster';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
